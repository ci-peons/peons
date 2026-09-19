import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Journal, journalFileFor } from "./journal.ts";

test("appends one JSON line per event into a monthly file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "j-"));
  const j = new Journal(dir, true);
  const run = { tenant: "local", repo: "r", sha: "s", surface: "cli" as const };
  await j.append({ type: "run_complete", at: "2026-09-19T10:00:00.000Z", run, findings: 0, cost_usd: 0, duration_ms: 1, exit: 0 });
  await j.append({ type: "run_complete", at: "2026-09-19T10:00:01.000Z", run, findings: 1, cost_usd: 0, duration_ms: 1, exit: 1 });
  const lines = readFileSync(join(dir, journalFileFor(new Date("2026-09-19T10:00:00Z"))), "utf8").trim().split("\n");
  expect(lines).toHaveLength(2); expect(JSON.parse(lines[1]!).exit).toBe(1);
});
test("disabled journal writes nothing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "j-"));
  await new Journal(dir, false).append({ type: "run_complete", at: new Date().toISOString(), run: { tenant: "local", repo: "r", sha: "s", surface: "cli" }, findings: 0, cost_usd: 0, duration_ms: 1, exit: 0 });
  expect(readdirSync(dir)).toEqual([]);
});
