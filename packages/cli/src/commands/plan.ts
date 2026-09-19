import { loadConfig, computeChangeSet, PathPlanner, type ScopeSpec } from "@peons/core";
import type { Ctx } from "../index.ts";
export function parseScope(scope: string | undefined, base: string | undefined, files: string[]): ScopeSpec {
  if (scope === "files" || (!scope && files.length)) return { kind: "files", paths: files };
  if (scope === "branch") return { kind: "branch", base };
  if (!scope || scope === "staged") return { kind: "staged" };
  throw new Error(`unknown scope "${scope}" (staged | branch | files)`);
}
export async function plan(files: string[], opts: { scope?: string; base?: string; format?: string }, ctx: Ctx): Promise<number> {
  const cfg = await loadConfig(ctx.cwd);
  const changes = await computeChangeSet(ctx.cwd, parseScope(opts.scope, opts.base, files));
  const p = await new PathPlanner().plan(cfg, changes);
  if (opts.format === "json") { ctx.stdout(JSON.stringify(p, null, 2) + "\n"); return 0; }
  ctx.stdout(`Change set: ${changes.files.length} file(s)${changes.base ? ` against ${changes.base}` : ""}\n`);
  for (const e of p.entries) { ctx.stdout(`\n${e.peon}\n`); for (const f of e.files) ctx.stdout(`  ${f.path}  (${f.reason})\n`); }
  if (p.skipped.length) { ctx.stdout(`\nSkipped\n`); for (const s of p.skipped) ctx.stdout(`  ${s.peon}: ${s.reason}\n`); }
  for (const w of changes.warnings) ctx.stderr(`warning: ${w}\n`);
  return 0;
}
