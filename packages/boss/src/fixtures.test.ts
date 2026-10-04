import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBossFixtures, synthesiseChangeSet, bossTest } from "./fixtures.ts";
import { FakeDecisionProvider } from "./decision/fake.ts";
import type { ResolvedConfig, ResolvedPeon } from "@peons/core";

const P = (name: string, paths: string[], triggers: string[] = []): ResolvedPeon => ({ name, version: "1.0.0", hash: "h", dir: "/x", source: { kind: "local", dir: "/x" }, manifest: { description: `${name} reviewer`, triggers } as never, guidance: "", checks: [], body: "", paths, block: "high", enabled: true });
const cfg = (peons: ResolvedPeon[]): ResolvedConfig => ({ root: "/r", provider: "anthropic", models: {} as never, budget: { tokensPerPeon: 1 }, journal: false, peons, boss: { enabled: true, provider: "auto", model: "jev-latest", budget: { maxPeons: 5 }, always: [], neverSkip: [], thresholds: { dispatch: 0.7, prune: 0.15 } } });
function root(): string {
  const r = mkdtempSync(join(tmpdir(), "bf-")); mkdirSync(join(r, ".peons/boss-fixtures"), { recursive: true });
  writeFileSync(join(r, ".peons/boss-fixtures/a11y-only.yaml"), `intent: "Add alt text"\nfiles:\n  - { path: "apps/web/Hero.tsx", added: 3, removed: 1 }\nexpect: [a11y]\nreject: [react]\n`);
  writeFileSync(join(r, ".peons/boss-fixtures/trigger.yaml"), `files:\n  - { path: "lib/html.ts", status: added, added: 2, added_lines: ["el.innerHTML = raw"] }\nexpect: [sec]\n`);
  return r;
}
test("loads and validates fixtures; unknown peon names rejected", async () => {
  const r = root();
  const fx = await loadBossFixtures(r); expect(fx.map((f) => f.name)).toEqual(["a11y-only", "trigger"]);
  writeFileSync(join(r, ".peons/boss-fixtures/bad.yaml"), `files: []\n`);
  await expect(loadBossFixtures(r)).rejects.toThrow(/bad/);
});
test("synthesises a change set with added_lines and padding", async () => {
  const [f] = await loadBossFixtures(root());
  const cs = synthesiseChangeSet(f!);
  expect(cs.files[0]!.path).toBe("apps/web/Hero.tsx"); expect(cs.files[0]!.hunks[0]!.text.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"))).toHaveLength(3);
});
test("scores recall and precision across fixtures", async () => {
  const r = root();
  const peons = [P("a11y", ["**/*.tsx"]), P("react", ["**/*.tsx"]), P("sec", ["server/**"], ["innerHTML"])];
  const fake = new FakeDecisionProvider((q) => Object.fromEntries(Object.keys(q).map((k) => [k, k === "risk" ? { type: "score", score: 1, confidence: 1, probabilities: { "1": 1 } } : { type: "noul", noul: k === "peon:react" ? 0.1 : 0.5 }])));
  const res = await bossTest({ root: r, config: cfg(peons), provider: fake });
  // a11y-only: paths plan a11y and react; react pruned at 0.1 -> planned [a11y]; trigger: sec planned via trigger
  expect(res.fixtures[0]!.planned).toEqual(["a11y"]); expect(res.fixtures[1]!.planned).toEqual(["sec"]);
  expect(res.recall).toBe(1); expect(res.precision).toBe(1); expect(res.passed).toBe(true);
});
test("a planned reject peon is a false positive and fails the gate", async () => {
  const r = root();
  const res = await bossTest({ root: r, config: cfg([P("a11y", ["**/*.tsx"]), P("react", ["**/*.tsx"]), P("sec", ["server/**"], ["innerHTML"])]), provider: null });
  expect(res.fixtures[0]!.falsePositives).toEqual(["react"]); expect(res.precision).toBeLessThan(0.85); expect(res.passed).toBe(false);
});
