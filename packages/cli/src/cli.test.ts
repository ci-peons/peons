import { test, expect } from "bun:test";
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./index.ts";

function capture() { let out = ""; let err = ""; return { stdout: (s: string) => { out += s; }, stderr: (s: string) => { err += s; }, out: () => out, err: () => err }; }

test("init writes config, gitignore and claude files", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cli-")); const c = capture();
  expect(await runCli(["init", "--claude", "--yes"], { cwd, ...c })).toBe(0);
  expect(existsSync(join(cwd, "peons.yaml"))).toBe(true);
  expect(readFileSync(join(cwd, ".peons/.gitignore"), "utf8")).toContain("cache/");
  expect(existsSync(join(cwd, ".claude/skills/peons/SKILL.md"))).toBe(true);
  expect(existsSync(join(cwd, ".claude/commands/peons.md"))).toBe(true);
  expect(await runCli(["init", "--yes"], { cwd, ...c })).toBe(0); // idempotent, does not overwrite
});
test("list and plan in plain mode; missing config is exit 2", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cli-")); const c = capture();
  expect(await runCli(["list"], { cwd, ...c })).toBe(2);
  expect(c.err()).toContain("peons init");
  mkdirSync(join(cwd, "peons/p"), { recursive: true });
  writeFileSync(join(cwd, "peons/p/peon.md"), `---\nname: p\nversion: 1.0.0\ndescription: d\npaths: ["**/*.tsx"]\npermissions:\n  read: ["**"]\n---\n## Checks\n### c\nx\n`);
  writeFileSync(join(cwd, "peons.yaml"), "peons:\n  - use: ./peons/p\n");
  writeFileSync(join(cwd, "a.tsx"), "x\n");
  const c2 = capture();
  expect(await runCli(["list"], { cwd, ...c2 })).toBe(0);
  expect(c2.out()).toContain("p@1.0.0"); expect(c2.out()).toContain("local");
  const c3 = capture();
  expect(await runCli(["plan", "--scope", "files", "a.tsx", "--format", "json"], { cwd, ...c3 })).toBe(0);
  expect(JSON.parse(c3.out()).entries[0].peon).toBe("p");
});
test("unknown command or option exits 2, not commander's default 1", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "cli-")); const c = capture();
  expect(await runCli(["frobnicate"], { cwd, ...c })).toBe(2);
  mkdirSync(join(cwd, "peons/p"), { recursive: true });
  writeFileSync(join(cwd, "peons/p/peon.md"), `---\nname: p\nversion: 1.0.0\ndescription: d\npaths: ["**/*.tsx"]\npermissions:\n  read: ["**"]\n---\n## Checks\n### c\nx\n`);
  writeFileSync(join(cwd, "peons.yaml"), "peons:\n  - use: ./peons/p\n");
  const c2 = capture();
  expect(await runCli(["run", "--bogus"], { cwd, ...c2 })).toBe(2);
});
