import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { EngineError, loadConfig, type ChangeSet, type ChangedFile, type ResolvedConfig } from "@peons/core";
import { BossPlanner } from "./planner.ts";
import type { DecisionProvider } from "./decision/types.ts";

export const BossFixtureSchema = z.object({
  intent: z.string().optional(),
  files: z.array(z.object({ path: z.string().min(1), status: z.enum(["added", "modified", "renamed"]).default("modified"), added: z.number().int().min(0).default(0), removed: z.number().int().min(0).default(0), added_lines: z.array(z.string()).default([]) })).min(1),
  expect: z.array(z.string()).default([]),
  reject: z.array(z.string()).default([]),
  // Per-fixture budget override, so one fixture can exercise the budget cut without forcing a
  // tiny max_peons on every other fixture in the suite.
  boss: z.object({ max_peons: z.number().int().positive().optional() }).optional(),
});
export type BossFixture = z.infer<typeof BossFixtureSchema> & { name: string };

export async function loadBossFixtures(root: string, peonNames?: string[]): Promise<BossFixture[]> {
  const dir = join(root, ".peons", "boss-fixtures");
  let names: string[] = []; try { names = (await readdir(dir)).filter((n) => /\.ya?ml$/.test(n)).sort(); } catch { return []; }
  const out: BossFixture[] = [];
  for (const n of names) {
    const parsed = BossFixtureSchema.safeParse(parseYaml(await readFile(join(dir, n), "utf8")));
    if (!parsed.success) throw new EngineError("FIXTURE", `boss fixture ${n}: ` + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    if (peonNames) for (const p of [...parsed.data.expect, ...parsed.data.reject]) if (!peonNames.includes(p)) throw new EngineError("FIXTURE", `boss fixture ${n} names unknown peon "${p}"`);
    out.push({ ...parsed.data, name: basename(n).replace(/\.ya?ml$/, "") });
  }
  return out;
}
export function synthesiseChangeSet(f: BossFixture): ChangeSet {
  const files: ChangedFile[] = f.files.map((x) => {
    const plus = [...x.added_lines, ...Array(Math.max(0, x.added - x.added_lines.length)).fill("x")].map((l) => "+" + l);
    const minus = Array(x.removed).fill("-x");
    const text = [`@@ -1,${x.removed} +1,${plus.length} @@`, ...plus, ...minus].join("\n");
    return { path: x.path, status: x.status, content: plus.map((l) => l.slice(1)).join("\n") + "\n", hunks: [{ oldStart: 1, oldLines: x.removed, newStart: 1, newLines: plus.length, text }] };
  });
  return { scope: { kind: "files", paths: files.map((x) => x.path) }, sha: "fixture", files, warnings: [] };
}
export type BossFixtureResult = { name: string; planned: string[]; reasons: Record<string, string>; expected: string[]; rejected: string[]; hits: string[]; falsePositives: string[]; misses: string[] };
export type BossTestResult = { fixtures: BossFixtureResult[]; precision: number; recall: number; passed: boolean; failures: string[]; provider: string };

export async function bossTest(opts: { root: string; config?: ResolvedConfig; provider: DecisionProvider | null; runs?: number; minPrecision?: number; minRecall?: number }): Promise<BossTestResult> {
  const cfg = opts.config ?? (await loadConfig(opts.root));
  const fixtures = await loadBossFixtures(opts.root, cfg.peons.map((p) => p.name));
  const runs = Math.max(1, opts.runs ?? 1);
  const results: BossFixtureResult[] = [];
  for (const f of fixtures) {
    const fixtureCfg: ResolvedConfig = { ...cfg, boss: { ...cfg.boss, budget: { maxPeons: f.boss?.max_peons ?? cfg.boss.budget.maxPeons } } };
    const counts = new Map<string, number>(); const reasons: Record<string, string> = {};
    for (let i = 0; i < runs; i++) {
      const plan = await new BossPlanner({ provider: opts.provider, intent: f.intent }).plan(fixtureCfg, synthesiseChangeSet(f));
      for (const e of plan.entries) { if (cfg.boss.always.includes(e.peon)) continue; counts.set(e.peon, (counts.get(e.peon) ?? 0) + 1); reasons[e.peon] = e.files[0]?.reason ?? ""; }
      for (const s of plan.skipped) reasons[s.peon] ??= s.reason;
    }
    const planned = [...counts.entries()].filter(([, n]) => n * 2 > runs).map(([p]) => p).sort();
    const hits = planned.filter((p) => f.expect.includes(p));
    results.push({ name: f.name, planned, reasons, expected: f.expect, rejected: f.reject, hits, falsePositives: planned.filter((p) => !f.expect.includes(p)), misses: f.expect.filter((p) => !planned.includes(p)) });
  }
  const sum = (k: "hits" | "planned" | "expected") => results.reduce((n, r) => n + r[k].length, 0);
  const recall = sum("expected") ? sum("hits") / sum("expected") : 1;
  const precision = sum("planned") ? sum("hits") / sum("planned") : 1;
  const minP = opts.minPrecision ?? 0.85, minR = opts.minRecall ?? 0.7;
  const failures: string[] = [];
  // An empty suite would otherwise score a vacuous 1.00/1.00 and PASS, which is exactly the
  // signal that hides a missing or misnamed .peons/boss-fixtures directory.
  if (fixtures.length === 0) failures.push("no boss fixtures found in .peons/boss-fixtures");
  if (recall < minR) failures.push(`recall ${recall.toFixed(2)} below ${minR}`);
  if (precision < minP) failures.push(`precision ${precision.toFixed(2)} below ${minP}`);
  return { fixtures: results, precision, recall, passed: failures.length === 0, failures, provider: opts.provider?.kind ?? "none" };
}
