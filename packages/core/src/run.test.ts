import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./run.ts";
import { FakeProvider } from "./provider/fake.ts";
import { EngineError } from "./errors.ts";

const PEON = (name: string, block = "high") => `---
name: ${name}
version: 1.0.0
description: d
paths: ["**/*.tsx"]
severity: { default: medium, block: ${block} }
permissions:
  read: ["**/*.tsx"]
---
## Checks
### img-alt
Images need alt.
`;
function repo(order: string[] = ["a11y", "react"]): string {
  const root = mkdtempSync(join(tmpdir(), "run-"));
  mkdirSync(join(root, "peons/a11y"), { recursive: true }); writeFileSync(join(root, "peons/a11y/peon.md"), PEON("a11y"));
  mkdirSync(join(root, "peons/react"), { recursive: true }); writeFileSync(join(root, "peons/react/peon.md"), PEON("react", "critical"));
  writeFileSync(join(root, "peons.yaml"), "peons:\n" + order.map((n) => `  - use: ./peons/${n}\n`).join(""));
  mkdirSync(join(root, "src")); writeFileSync(join(root, "src/a.tsx"), '<img src="x" />\n');
  return root;
}
const flag = () => ({ findings: [{ check: "img-alt", file: "src/a.tsx", range: [1, 1], severity: "high", message: "no alt", evidence: ['<img src="x" />'] }] });

test("runs planned peons, merges, exits 1 on blocking finding, journals", async () => {
  const root = repo(); const events: string[] = [];
  const r = await run({ root, scope: { kind: "files", paths: ["src/a.tsx"] }, surface: "cli", provider: new FakeProvider(flag), onEvent: (e) => events.push(e.type) });
  expect(r.findings).toHaveLength(1);           // merged duplicate across two peons
  expect(r.exit).toBe(1);                       // a11y blocks at high; react would not, but merge keeps one at high
  expect(r.peons.map((p) => p.status)).toEqual(["ok", "ok"]);
  expect(events).toEqual(["plan", "peon:start", "peon:start", "peon:done", "peon:done", "done"]);
  expect(readdirSync(join(root, ".peons/journal")).length).toBe(1);
});
test("blocking exit does not depend on peons.yaml order", async () => {
  const root = repo(["react", "a11y"]);
  const r = await run({ root, scope: { kind: "files", paths: ["src/a.tsx"] }, surface: "cli", provider: new FakeProvider(flag) });
  expect(r.exit).toBe(1);
});
test("failOn override and names filter", async () => {
  const root = repo();
  const r = await run({ root, scope: { kind: "files", paths: ["src/a.tsx"] }, surface: "cli", provider: new FakeProvider(flag), names: ["react"], failOn: "critical" });
  expect(r.peons.map((p) => p.name)).toEqual(["react"]); expect(r.exit).toBe(0);
});
test("second run hits cache", async () => {
  const root = repo(); const p = new FakeProvider(flag);
  await run({ root, scope: { kind: "files", paths: ["src/a.tsx"] }, surface: "cli", provider: p, names: ["a11y"] });
  const r = await run({ root, scope: { kind: "files", paths: ["src/a.tsx"] }, surface: "cli", provider: p, names: ["a11y"] });
  expect(p.calls).toHaveLength(1); expect(r.peons[0]!.status).toBe("cached"); expect(r.findings).toHaveLength(1);
});
test("provider failure marks peon error and exits 2, others continue", async () => {
  const root = repo(); let n = 0;
  const p = new FakeProvider(() => (n++ === 0 ? new EngineError("PROVIDER", "boom") : { findings: [] }));
  const r = await run({ root, scope: { kind: "files", paths: ["src/a.tsx"] }, surface: "cli", provider: p });
  expect(r.exit).toBe(2); expect(r.peons.filter((x) => x.status === "error")).toHaveLength(1); expect(r.peons.filter((x) => x.status === "ok")).toHaveLength(1);
});
test("empty change set yields exit 0 and no provider calls", async () => {
  const root = repo(); const p = new FakeProvider(flag);
  const r = await run({ root, scope: { kind: "files", paths: ["README.md"] }, surface: "cli", provider: p });
  expect(p.calls).toHaveLength(0); expect(r.exit).toBe(0); expect(r.plan.entries).toEqual([]);
});
