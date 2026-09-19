import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import * as p from "@clack/prompts";
import peonsYaml from "../templates/peons.yaml" with { type: "text" };
import skillMd from "../templates/skill.md" with { type: "text" };
import commandMd from "../templates/command.md" with { type: "text" };
import type { Ctx } from "../index.ts";
import { NO_REGISTRY_YET } from "../messages.ts";

async function writeIfMissing(path: string, content: string, ctx: Ctx): Promise<boolean> {
  try { await access(path); ctx.stderr(`exists, kept: ${path}\n`); return false; }
  catch { await mkdir(join(path, ".."), { recursive: true }); await writeFile(path, content); ctx.stdout(`created ${path}\n`); return true; }
}
export async function init(opts: { claude?: boolean; yes?: boolean }, ctx: Ctx, tty: boolean): Promise<number> {
  let claude = !!opts.claude;
  if (tty && !opts.yes) {
    p.intro("peons init");
    if (!opts.claude) { const a = await p.confirm({ message: "Install the Claude Code skill and /peons command?" }); if (p.isCancel(a)) return 2; claude = a; }
  }
  await writeIfMissing(join(ctx.cwd, "peons.yaml"), peonsYaml, ctx);
  await writeIfMissing(join(ctx.cwd, ".peons", ".gitignore"), "cache/\njournal/\ninstalled/\n", ctx);
  if (claude) {
    await writeIfMissing(join(ctx.cwd, ".claude", "skills", "peons", "SKILL.md"), skillMd, ctx);
    await writeIfMissing(join(ctx.cwd, ".claude", "commands", "peons.md"), commandMd, ctx);
  }
  const next = `${NO_REGISTRY_YET} Then: peons run --scope staged. Set PEONS_API_KEY in your shell.`;
  if (tty && !opts.yes) p.outro(next);
  else ctx.stdout(next + "\n");
  return 0;
}
