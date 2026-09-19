import { loadConfig } from "@peons/core";
import type { Ctx } from "../index.ts";
import { NO_REGISTRY_YET } from "../messages.ts";
export async function list(opts: { format?: string }, ctx: Ctx): Promise<number> {
  const cfg = await loadConfig(ctx.cwd);
  const rows = cfg.peons.map((p) => ({ name: `${p.name}@${p.version}`, source: p.source.kind, hash: p.hash.slice(7, 19), paths: p.paths.join(", "), read: p.manifest.permissions.read.join(", "), enabled: p.enabled ? "yes" : `no (${p.reason})`, block: p.block }));
  if (opts.format === "json") { ctx.stdout(JSON.stringify(rows, null, 2) + "\n"); return 0; }
  const w = Math.max(4, ...rows.map((r) => r.name.length));
  ctx.stdout(`${"NAME".padEnd(w)}  SOURCE     HASH          BLOCK     ENABLED  PATHS\n`);
  for (const r of rows) {
    ctx.stdout(`${r.name.padEnd(w)}  ${r.source.padEnd(9)}  ${r.hash}  ${r.block.padEnd(8)}  ${r.enabled.padEnd(7)}  ${r.paths}\n`);
    ctx.stdout(`${" ".repeat(w)}  READ: ${r.read}\n`);
  }
  if (!rows.length) ctx.stdout(`No peons configured. ${NO_REGISTRY_YET}\n`);
  return 0;
}
