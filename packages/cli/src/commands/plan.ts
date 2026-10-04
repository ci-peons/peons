import { loadConfig, computeChangeSet, PathPlanner, type ScopeSpec, type Planner, type ResolvedConfig } from "@peons/core";
import type { BossInfo } from "@peons/schema";
import { BossPlanner, selectDecisionProvider, resolveIntent, type DecisionProvider } from "@peons/boss";
import type { Ctx } from "../index.ts";
export function parseScope(scope: string | undefined, base: string | undefined, files: string[]): ScopeSpec {
  if (scope === "files" || (!scope && files.length)) return { kind: "files", paths: files };
  if (scope === "branch") return { kind: "branch", base };
  if (!scope || scope === "staged") return { kind: "staged" };
  throw new Error(`unknown scope "${scope}" (staged | branch | files)`);
}
export type AutoOpts = { auto?: boolean; intent?: string };
export function wantsAuto(config: ResolvedConfig, o: AutoOpts): boolean { return o.auto ?? config.boss.enabled; }
export async function choosePlanner(config: ResolvedConfig, o: AutoOpts, deps: { decision?: DecisionProvider | null }, root: string): Promise<Planner> {
  if (!wantsAuto(config, o)) return new PathPlanner();
  const provider = deps.decision !== undefined ? deps.decision : selectDecisionProvider(config);
  return new BossPlanner({ provider, intent: await resolveIntent(root, o.intent) });
}
export function formatBossFooter(b?: BossInfo): string {
  if (!b) return "";
  // "decision skipped: plan settled" would read as "decision=skipped (decision skipped: ...)".
  const why = b.decisionSkipped?.replace(/^decision skipped: /, "");
  const decision = why ? `skipped (${why})` : "made";
  return `Boss: provider=${b.provider}${b.model ? ` model=${b.model}` : ""}${b.risk !== undefined ? ` risk=${b.risk.toFixed(2)}` : ""} decision=${decision}\n`;
}
export async function plan(files: string[], opts: { scope?: string; base?: string; format?: string; auto?: boolean; intent?: string }, ctx: Ctx, deps: { decision?: DecisionProvider | null } = {}): Promise<number> {
  const cfg = await loadConfig(ctx.cwd);
  const changes = await computeChangeSet(ctx.cwd, parseScope(opts.scope, opts.base, files));
  const planner = await choosePlanner(cfg, opts, deps, ctx.cwd);
  const p = await planner.plan(cfg, changes);
  if (opts.format === "json") { ctx.stdout(JSON.stringify(p, null, 2) + "\n"); return 0; }
  ctx.stdout(`Change set: ${changes.files.length} file(s)${changes.base ? ` against ${changes.base}` : ""}\n`);
  for (const e of p.entries) { ctx.stdout(`\n${e.peon}\n`); for (const f of e.files) ctx.stdout(`  ${f.path}  (${f.reason})\n`); }
  if (p.skipped.length) { ctx.stdout(`\nSkipped\n`); for (const s of p.skipped) ctx.stdout(`  ${s.peon}: ${s.reason}\n`); }
  if (p.boss) ctx.stdout(`\n${formatBossFooter(p.boss)}`);
  for (const w of changes.warnings) ctx.stderr(`warning: ${w}\n`);
  return 0;
}
