#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { EngineError } from "@peons/core";
import { isTTYMode } from "./mode.ts";
import { init } from "./commands/init.ts";
import { list } from "./commands/list.ts";
import { plan } from "./commands/plan.ts";
import { runCommand, type RunOpts, type Deps } from "./commands/run.ts";
import { testCommand, type TestOpts } from "./commands/test.ts";

export type Ctx = { cwd: string; stdout: (s: string) => void; stderr: (s: string) => void };

export function splitNamesAndFiles(args: string[], cwd: string, scope?: string): { names: string[]; files: string[] } {
  if (scope !== "files") return { names: args, files: [] };
  const names: string[] = []; const files: string[] = [];
  for (const a of args) (files.length || existsSync(join(cwd, a)) ? files : names).push(a);
  return { names, files };
}

export async function runCli(argv: string[], ctx: Ctx, deps: Partial<Deps> = {}): Promise<number> {
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
  program.command("run [names...]").description("Run peons on a change set")
    .option("--scope <s>", "staged | branch | files").option("--base <ref>").option("--format <f>", "agent | json | sarif")
    .option("--fail-on <severity>").option("--all-files", "ignore path matching for named peons").option("--no-cache")
    .allowExcessArguments(true)
    .action((names: string[], o: RunOpts) => wrap(() => {
      // with --scope files, positional args after the peon names are file paths: split on the first arg that exists on disk
      const { names: n, files } = splitNamesAndFiles(names, ctx.cwd, o.scope);
      return runCommand(n, files, o, ctx, { provider: deps.provider, tty: deps.tty ?? isTTYMode(o) });
    })());
  program.command("test [names...]").description("Run fixtures and report recall and precision")
    .option("--runs <n>").option("--min-precision <f>").option("--min-recall <f>").option("--format <f>", "json")
    .action((names: string[], o: TestOpts) => wrap(() => testCommand(names, o, ctx, { provider: deps.provider, tty: deps.tty ?? isTTYMode(o) }))());
  try { await program.parseAsync(argv, { from: "user" }); } catch (e) { const err = e as { code?: string; exitCode?: number }; if (err.code === "commander.helpDisplayed" || err.code === "commander.version") return 0; return err.exitCode ?? 2; }
  return code;
}

if (import.meta.main) {
  runCli(process.argv.slice(2), { cwd: process.cwd(), stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) }).then((c) => process.exit(c));
}
