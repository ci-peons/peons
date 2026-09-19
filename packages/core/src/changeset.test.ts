import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { computeChangeSet } from "./changeset.ts";

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "cs-"));
  const g = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  g("init", "-q", "-b", "main"); g("config", "user.email", "t@t"); g("config", "user.name", "t");
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/a.tsx"), "one\ntwo\n");
  writeFileSync(join(root, "src/del.tsx"), "bye\n");
  g("add", "."); g("commit", "-qm", "init");
  return root;
}
test("staged scope: added, modified, deleted excluded", async () => {
  const root = repo();
  const g = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  writeFileSync(join(root, "src/a.tsx"), "one\ntwo\nthree\n");
  writeFileSync(join(root, "src/b.tsx"), "new\n");
  g("rm", "-q", "src/del.tsx"); g("add", ".");
  const cs = await computeChangeSet(root, { kind: "staged" });
  expect(cs.files.map((f) => [f.path, f.status])).toEqual([["src/a.tsx", "modified"], ["src/b.tsx", "added"]]);
  expect(cs.files[0]!.content).toBe("one\ntwo\nthree\n");
  expect(cs.files[0]!.hunks.length).toBe(1);
});
test("branch scope diffs against merge base", async () => {
  const root = repo();
  const g = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  g("checkout", "-qb", "feat");
  writeFileSync(join(root, "src/c.tsx"), "c\n"); g("add", "."); g("commit", "-qm", "c");
  const cs = await computeChangeSet(root, { kind: "branch", base: "main" });
  expect(cs.files.map((f) => f.path)).toEqual(["src/c.tsx"]);
  expect(cs.base).toBe("main");
});
test("files scope treats whole file as one hunk and skips binaries and big files", async () => {
  const root = repo();
  writeFileSync(join(root, "src/bin.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
  writeFileSync(join(root, "src/big.tsx"), "x".repeat(200 * 1024 + 1));
  const cs = await computeChangeSet(root, { kind: "files", paths: ["src/a.tsx", "src/bin.png", "src/big.tsx"] });
  expect(cs.files.map((f) => f.path)).toEqual(["src/a.tsx"]);
  expect(cs.files[0]!.hunks[0]!.text).toContain("+one");
  expect(cs.warnings.length).toBe(2);
});
