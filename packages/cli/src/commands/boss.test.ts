import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeProvider } from "@peons/core";
import { FakeDecisionProvider } from "@peons/boss";
import { runCli } from "../index.ts";

function repo(boss = ""): string {
  const cwd = mkdtempSync(join(tmpdir(), "boss-cli-"));
  for (const [n, paths] of [["a11y", '"**/*.tsx"'], ["sql", '"db/**"']] as const) {
    mkdirSync(join(cwd, `peons/${n}`), { recursive: true });
    writeFileSync(join(cwd, `peons/${n}/peon.md`), `---\nname: ${n}\nversion: 1.0.0\ndescription: ${n} reviewer\npaths: [${paths}]\npermissions:\n  read: ["**"]\n---\n## Checks\n### c\nx\n`);
  }
  writeFileSync(join(cwd, "peons.yaml"), `${boss}peons:\n  - use: ./peons/a11y\n  - use: ./peons/sql\n`);
  writeFileSync(join(cwd, "a.tsx"), "x\n");
  mkdirSync(join(cwd, ".peons/boss-fixtures"), { recursive: true });
  writeFileSync(join(cwd, ".peons/boss-fixtures/one.yaml"), `files:\n  - { path: "a.tsx", added: 1 }\nexpect: [a11y]\nreject: [sql]\n`);
  return cwd;
}
const decision = new FakeDecisionProvider((q) => Object.fromEntries(Object.keys(q).map((k) => [k, k === "risk" ? { type: "score", score: 2, confidence: 1, probabilities: { "2": 1 } } : { type: "noul", noul: k === "peon:sql" ? 0.88 : 0.9 }])));
const provider = new FakeProvider(() => ({ findings: [] }));
function capture() { let out = ""; let err = ""; return { stdout: (s: string) => { out += s; }, stderr: (s: string) => { err += s; }, out: () => out, err: () => err }; }

test("plan --auto dispatches by intent and prints the boss footer", async () => {
  const cwd = repo(); const c = capture();
  expect(await runCli(["plan", "--auto", "--intent", "Add a query", "--scope", "files", "a.tsx"], { cwd, ...c }, { decision })).toBe(0);
  expect(c.out()).toContain("sql"); expect(c.out()).toContain("intent p=0.88");
  expect(c.out()).toMatch(/Boss: provider=fake model=fake risk=2(\.0+)? decision=made/);
});
test("plan without --auto is unchanged; boss.enabled implies --auto; --no-auto disables", async () => {
  const c1 = capture(); expect(await runCli(["plan", "--scope", "files", "a.tsx"], { cwd: repo(), ...c1 }, { decision })).toBe(0); expect(c1.out()).not.toContain("Boss:");
  const c2 = capture(); expect(await runCli(["plan", "--scope", "files", "a.tsx"], { cwd: repo("boss:\n  enabled: true\n"), ...c2 }, { decision })).toBe(0); expect(c2.out()).toContain("Boss:");
  const c3 = capture(); expect(await runCli(["plan", "--no-auto", "--scope", "files", "a.tsx"], { cwd: repo("boss:\n  enabled: true\n"), ...c3 }, { decision })).toBe(0); expect(c3.out()).not.toContain("Boss:");
});
test("run --auto plans sql by intent and json result carries plan.boss", async () => {
  const cwd = repo(); const c = capture();
  expect(await runCli(["run", "--auto", "--intent", "Add a query", "--scope", "files", "a.tsx", "--format", "json"], { cwd, ...c }, { provider, decision, tty: false })).toBe(0);
  const r = JSON.parse(c.out()); expect(r.peons.map((p: { name: string }) => p.name).sort()).toEqual(["a11y", "sql"]); expect(r.plan.boss.probabilities.sql).toBe(0.88);
});
test("boss-test scores fixtures and exits 1 below thresholds", async () => {
  const cwd = repo(); const c = capture();
  expect(await runCli(["boss-test"], { cwd, ...c }, { decision })).toBe(1);   // sql (reject) is dispatched at 0.88 -> precision 0.5
  expect(c.out()).toContain("one"); expect(c.out()).toMatch(/precision 0\.50/);
  const c2 = capture(); expect(await runCli(["boss-test", "--min-precision", "0.5"], { cwd, ...c2 }, { decision })).toBe(0);
});
test("boss-test validates --provider and numeric options", async () => {
  const cwd = repo();
  const c1 = capture(); expect(await runCli(["boss-test", "--provider", "foo"], { cwd, ...c1 }, { decision })).toBe(2); expect(c1.err()).toContain('unknown provider "foo"');
  const c2 = capture(); expect(await runCli(["boss-test", "--runs", "abc"], { cwd, ...c2 }, { decision })).toBe(2); expect(c2.err()).toContain("--runs must be a number");
  const c3 = capture(); expect(await runCli(["boss-test", "--provider", "llm", "--min-precision", "0.5"], { cwd, ...c3 }, { decision })).toBe(0);
});
