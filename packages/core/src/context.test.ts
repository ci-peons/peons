import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildContextPack, PermissionError } from "./context.ts";
import type { ResolvedPeon } from "./config.ts";
import type { ChangedFile } from "./changeset.ts";

function peon(read: string[], docs: string[] = [], tests: string[] = []): ResolvedPeon {
  return {
    name: "p", version: "1.0.0", hash: "h", dir: "/x", source: { kind: "local", dir: "/x" },
    manifest: { permissions: { read }, context: { docs, tests } } as never,
    guidance: "g", checks: [{ id: "c", title: "c", description: "d" }], body: "body", paths: ["**"], block: "high", enabled: true,
  };
}
const cf = (path: string, content = "x\n"): ChangedFile => ({ path, status: "added", content, hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, text: "@@ -0,0 +1 @@\n+x" }] });
function root(): string {
  const r = mkdtempSync(join(tmpdir(), "ctx-"));
  mkdirSync(join(r, "docs/a11y"), { recursive: true }); mkdirSync(join(r, "src"), { recursive: true });
  writeFileSync(join(r, "docs/a11y/rules.md"), "# rules\n");
  writeFileSync(join(r, "src/a.test.tsx"), "test\n");
  writeFileSync(join(r, "src/b.test.tsx"), "other\n");
  return r;
}
test("includes docs and neighbouring tests", async () => {
  const pack = await buildContextPack(peon(["**"], ["docs/a11y/**"], ["**/*.test.tsx"]), [cf("src/a.tsx")], root(), 60000);
  expect(pack.docs.map((d) => d.path)).toEqual(["docs/a11y/rules.md"]);
  expect(pack.tests.map((t) => t.path)).toEqual(["src/a.test.tsx", "src/b.test.tsx"]); // same directory
  expect(pack.hash).toHaveLength(64);
});
test("changed file outside permissions fails the run", async () => {
  await expect(buildContextPack(peon(["src/**"]), [cf("lib/z.tsx")], root(), 60000)).rejects.toBeInstanceOf(PermissionError);
});
test("budget drops docs, then tests, then degrades files to hunks", async () => {
  const big = "y".repeat(400); // 100 tokens
  const pack = await buildContextPack(peon(["**"], ["docs/a11y/**"], ["**/*.test.tsx"]), [cf("src/a.tsx", big)], root(), 60);
  expect(pack.docs).toEqual([]); expect(pack.tests).toEqual([]);
  expect(pack.files[0]!.hunksOnly).toBe(true);
  expect(pack.dropped.map((d) => d.reason)).toEqual(["budget", "budget", "budget", "budget"]);
});
test("hash is stable for same inputs", async () => {
  const a = await buildContextPack(peon(["**"]), [cf("src/a.tsx")], root(), 60000);
  const b = await buildContextPack(peon(["**"]), [cf("src/a.tsx")], root(), 60000);
  expect(a.hash).toBe(b.hash);
});
