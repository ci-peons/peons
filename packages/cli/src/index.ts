#!/usr/bin/env node
import { Command } from "commander";
import { EngineError } from "@peons/core";
import { isTTYMode } from "./mode.ts";
import { init } from "./commands/init.ts";
import { list } from "./commands/list.ts";
import { plan } from "./commands/plan.ts";

export type Ctx = { cwd: string; stdout: (s: string) => void; stderr: (s: string) => void };

export async function runCli(argv: string[], ctx: Ctx): Promise<number> {
  const program = new Command().name("peons").description("Specialised, testable AI code reviewers").exitOverride().configureOutput({ writeOut: ctx.stdout, writeErr: ctx.stderr });
  let code = 0;
  const wrap = (fn: () => Promise<number>) => async () => {
    try { code = await fn(); }
    catch (e) {
      if (e instanceof EngineError) { ctx.stderr(`error [${e.code}]: ${e.message}\n`); code = 2; }
      else { ctx.stderr(`error: ${(e as Error).message}\n`); code = 2; }
    }
  };
  program.command("init").description("Create peons.yaml and .peons/").option("--claude", "install the Claude Code skill and /peons command").option("-y, --yes", "no prompts")
    .action((o) => wrap(() => init(o, ctx, isTTYMode({})))());
  program.command("list").description("Show configured peons").option("--format <f>", "json")
    .action((o) => wrap(() => list(o, ctx))());
  program.command("plan [files...]").description("Show which peons would run, without calling a model")
    .option("--scope <s>", "staged | branch | files").option("--base <ref>", "base ref for branch scope").option("--format <f>", "json")
    .action((files, o) => wrap(() => plan(files, o, ctx))());
  try { await program.parseAsync(argv, { from: "user" }); } catch (e) { const err = e as { code?: string; exitCode?: number }; if (err.code === "commander.helpDisplayed" || err.code === "commander.version") return 0; return err.exitCode ?? 2; }
  return code;
}

if (import.meta.main) {
  runCli(process.argv.slice(2), { cwd: process.cwd(), stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) }).then((c) => process.exit(c));
}
