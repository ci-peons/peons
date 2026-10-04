#!/usr/bin/env node
import { Command } from "commander";
import { EngineError, loadConfig } from "@peons/core";
import { isTTYMode } from "./mode.ts";
import { init } from "./commands/init.ts";
import { list } from "./commands/list.ts";
import { plan } from "./commands/plan.ts";
import { runCommand, type RunOpts, type Deps } from "./commands/run.ts";
import { testCommand, type TestOpts } from "./commands/test.ts";
import { bossTestCommand, type BossTestOpts } from "./commands/boss-test.ts";

export type Ctx = { cwd: string; stdout: (s: string) => void; stderr: (s: string) => void };

// Classifies each positional arg against the *configured* peon names rather than disk existence:
// a peon whose name happens to match an existing path (e.g. a peon named "peons" in a repo with a
// peons/ directory) must never be misrouted into the file list.
export function splitNamesAndFiles(args: string[], peonNames: string[], scope?: string): { names: string[]; files: string[] } {
  const names: string[] = []; const files: string[] = [];
  for (const a of args) (peonNames.includes(a) || scope !== "files" ? names : files).push(a);
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
    .option("--auto", "let the Boss choose peons").option("--no-auto", "disable the Boss for this run").option("--intent <text>", "what this change is for")
    .action((files, o) => wrap(() => plan(files, o, ctx, { decision: deps.decision }))());
  program.command("run [names...]").description("Run peons on a change set")
    .option("--scope <s>", "staged | branch | files").option("--base <ref>").option("--format <f>", "agent | json | sarif")
    .option("--fail-on <severity>").option("--all-files", "ignore path matching for named peons").option("--no-cache")
    .option("--auto", "let the Boss choose peons").option("--no-auto", "disable the Boss for this run").option("--intent <text>", "what this change is for")
    .allowExcessArguments(true)
    .action((names: string[], o: RunOpts) => wrap(async () => {
      const config = await loadConfig(ctx.cwd);
      const { names: n, files } = splitNamesAndFiles(names, config.peons.map((p) => p.name), o.scope);
      return runCommand(n, files, o, ctx, { provider: deps.provider, tty: deps.tty ?? isTTYMode(o), decision: deps.decision }, config);
    })());
  program.command("test [names...]").description("Run fixtures and report recall and precision")
    .option("--runs <n>").option("--min-precision <f>").option("--min-recall <f>").option("--format <f>", "json")
    .action((names: string[], o: TestOpts) => wrap(() => testCommand(names, o, ctx, { provider: deps.provider, tty: deps.tty ?? isTTYMode(o) }))());
  program.command("boss-test").description("Score the Boss's routing against .peons/boss-fixtures")
    .option("--provider <p>", "jev | llm").option("--runs <n>").option("--min-precision <f>").option("--min-recall <f>").option("--format <f>", "json")
    .action((o: BossTestOpts) => wrap(() => bossTestCommand(o, ctx, { decision: deps.decision }))());
  try { await program.parseAsync(argv, { from: "user" }); }
  catch (e) {
    // commander's own usage errors (unknown command/option, missing argument, ...) default to
    // exitCode 1, which on this CLI means "a finding meets the block severity" — normalise every
    // CommanderError other than a plain --help/--version display to exit 2 (engine/usage failure).
    const err = e as { code?: string };
    return err.code === "commander.helpDisplayed" || err.code === "commander.version" ? 0 : 2;
  }
  return code;
}

if (import.meta.main) {
  runCli(process.argv.slice(2), { cwd: process.cwd(), stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) }).then((c) => process.exit(c));
}
