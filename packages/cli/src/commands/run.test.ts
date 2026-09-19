import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeProvider } from "@peons/core";
import { runCli } from "../index.ts";

function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "clirun-"));
  mkdirSync(join(cwd, "peons/p/fixtures/should-flag"), { recursive: true }); mkdirSync(join(cwd, "peons/p/fixtures/should-pass"), { recursive: true });
  writeFileSync(join(cwd, "peons/p/peon.md"), `---\nname: p\nversion: 1.0.0\ndescription: d\npaths: ["**/*.tsx"]\npermissions:\n  read: ["**"]\n---\n## Checks\n### c\nx\n`);
  writeFileSync(join(cwd, "peons/p/fixtures/should-flag/bad.tsx"), "bad\n"); writeFileSync(join(cwd, "peons/p/fixtures/should-flag/bad.expect.yaml"), "checks: [c]\n");
  writeFileSync(join(cwd, "peons/p/fixtures/should-pass/good.tsx"), "good\n");
  writeFileSync(join(cwd, "peons.yaml"), "peons:\n  - use: ./peons/p\n");
  writeFileSync(join(cwd, "a.tsx"), "bad\n");
  return cwd;
}
const provider = new FakeProvider((i) => {
  const m = /<file path="([^"]+)"[^>]*>\n+1: (.*)\n/.exec(i.user)!;
  return { findings: m[2] === "bad" ? [{ check: "c", file: m[1], range: [1, 1], severity: "high", message: "bad", evidence: ["bad"] }] : [] };
});
function capture() { let out = ""; let err = ""; return { stdout: (s: string) => { out += s; }, stderr: (s: string) => { err += s; }, out: () => out, err: () => err }; }

test("run --format agent prints contract and exits 1", async () => {
  const cwd = repo(); const c = capture();
  const code = await runCli(["run", "--scope", "files", "a.tsx", "--format", "agent"], { cwd, ...c }, { provider, tty: false });
  expect(code).toBe(1);
  expect(c.out()).toContain("## [HIGH] a.tsx:1 · p/c"); expect(c.out()).toContain("Exit code 1");
});
test("run --fail-on critical exits 0; --format json parses", async () => {
  const cwd = repo(); const c = capture();
  expect(await runCli(["run", "--scope", "files", "a.tsx", "--format", "json", "--fail-on", "critical"], { cwd, ...c }, { provider, tty: false })).toBe(0);
  expect(JSON.parse(c.out()).findings).toHaveLength(1);
});
test("run rejects unknown format and severity with exit 2", async () => {
  const cwd = repo(); const c = capture();
  expect(await runCli(["run", "--format", "xml"], { cwd, ...c }, { provider, tty: false })).toBe(2);
  expect(await runCli(["run", "--fail-on", "urgent"], { cwd, ...c }, { provider, tty: false })).toBe(2);
});
test("test prints per-check table and passes", async () => {
  const cwd = repo(); const c = capture();
  expect(await runCli(["test"], { cwd, ...c }, { provider, tty: false })).toBe(0);
  expect(c.out()).toContain("p/c"); expect(c.out()).toMatch(/recall\s+1\.00/);
});
