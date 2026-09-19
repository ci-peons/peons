import { run, formatResult, FORMATS, type FormatName, type Provider } from "@peons/core";
import { SeveritySchema, type Severity } from "@peons/schema";
import type { Ctx } from "../index.ts";
import { parseScope } from "./plan.ts";

// note: commander's `.option("--no-cache")` negatable flag exposes the value as `cache`
// (default true, false when --no-cache is passed), not as `noCache` — see index.ts registration.
export type RunOpts = { scope?: string; base?: string; format?: string; failOn?: string; allFiles?: boolean; cache?: boolean };
export type Deps = { provider?: Provider; tty: boolean };

export function validateRunOpts(o: RunOpts): { format: FormatName; failOn?: Severity } {
  const format = (o.format ?? "agent") as FormatName;
  if (!FORMATS.includes(format)) throw new Error(`unknown format "${o.format}" (${FORMATS.join(" | ")})`);
  const sev = o.failOn ? SeveritySchema.safeParse(o.failOn) : null;
  if (sev && !sev.success) throw new Error(`unknown severity "${o.failOn}" (${SeveritySchema.options.join(" | ")})`);
  return { format, failOn: sev?.success ? sev.data : undefined };
}
export async function runCommand(names: string[], files: string[], o: RunOpts, ctx: Ctx, deps: Deps): Promise<number> {
  const { format, failOn } = validateRunOpts(o);
  const scope = parseScope(o.scope, o.base, files);
  const opts = { root: ctx.cwd, scope, names: names.length ? names : undefined, allFiles: o.allFiles, failOn, noCache: o.cache === false, surface: process.env.CI ? "ci" as const : "cli" as const, provider: deps.provider };
  if (deps.tty) {
    // @ts-expect-error created in Task 20
    const { renderRun } = await import("../ui/RunView.tsx");
    return renderRun(opts);
  }
  const result = await run({ ...opts, onEvent: (e) => { if (e.type === "peon:start") ctx.stderr(`running ${e.name}@${e.version} on ${e.files} file(s)\n`); } });
  ctx.stdout(formatResult(result, format));
  return result.exit;
}
