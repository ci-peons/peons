import { loadConfig } from "@peons/core";
import { bossTest, selectDecisionProvider, type DecisionProvider } from "@peons/boss";
import type { Ctx } from "../index.ts";
export type BossTestOpts = { provider?: string; runs?: string; minPrecision?: string; minRecall?: string; format?: string };
function num(name: string, v?: string): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`${name} must be a number, got "${v}"`);
  return n;
}
export async function bossTestCommand(o: BossTestOpts, ctx: Ctx, deps: { decision?: DecisionProvider | null }): Promise<number> {
  if (o.provider && o.provider !== "jev" && o.provider !== "llm") throw new Error(`unknown provider "${o.provider}" (jev | llm)`);
  const config = await loadConfig(ctx.cwd);
  const cfg = o.provider ? { ...config, boss: { ...config.boss, provider: o.provider as "jev" | "llm" } } : config;
  const provider = deps.decision !== undefined ? deps.decision : selectDecisionProvider(cfg);
  const r = await bossTest({ root: ctx.cwd, config: cfg, provider, runs: num("--runs", o.runs), minPrecision: num("--min-precision", o.minPrecision), minRecall: num("--min-recall", o.minRecall) });
  if (o.format === "json") { ctx.stdout(JSON.stringify(r, null, 2) + "\n"); return r.passed ? 0 : 1; }
  for (const f of r.fixtures) {
    ctx.stdout(`${f.misses.length || f.falsePositives.length ? "✗" : "✓"} ${f.name}: planned [${f.planned.join(", ")}] expected [${f.expected.join(", ")}]${f.falsePositives.length ? ` false positives [${f.falsePositives.join(", ")}]` : ""}${f.misses.length ? ` missed [${f.misses.join(", ")}]` : ""}\n`);
    for (const [p, why] of Object.entries(f.reasons)) ctx.stdout(`    ${p}: ${why}\n`);
  }
  ctx.stdout(`\nprovider ${r.provider}  recall ${r.recall.toFixed(2)}  precision ${r.precision.toFixed(2)}  ${r.passed ? "PASS" : "FAIL"}\n`);
  for (const x of r.failures) ctx.stdout(`  ${x}\n`);
  return r.passed ? 0 : 1;
}
