import { join, basename } from "node:path";
import { atLeast, type Plan, type PeonRunStatus, type RunResult, type Severity, type Finding, type DroppedItem, type RunRef } from "@peons/schema";
import { loadConfig, type ResolvedConfig, type ResolvedPeon } from "./config.ts";
import { computeChangeSet, type ScopeSpec, type ChangeSet } from "./changeset.ts";
import { PathPlanner, type Planner } from "./planner.ts";
import { buildContextPack } from "./context.ts";
import { redactPack } from "./redact.ts";
import { buildReviewInput } from "./provider/prompt.ts";
import type { Provider } from "./provider/types.ts";
import { postFilter } from "./postfilter.ts";
import { mergeFindings } from "./merge.ts";
import { FindingsCache, cacheKey } from "./cache.ts";
import { Journal } from "./journal.ts";
import { EngineError } from "./errors.ts";

export type RunEvent =
  | { type: "plan"; plan: Plan }
  | { type: "peon:start"; name: string; version: string; files: number }
  | { type: "peon:done"; status: PeonRunStatus }
  | { type: "done"; result: RunResult };
export type RunOptions = {
  root: string; scope: ScopeSpec; names?: string[]; allFiles?: boolean; failOn?: Severity; noCache?: boolean;
  surface: "cli" | "ci" | "mcp"; provider?: Provider; planner?: Planner; onEvent?: (e: RunEvent) => void; config?: ResolvedConfig;
};

async function defaultProvider(): Promise<Provider> {
  const { AnthropicProvider } = await import("./provider/anthropic.ts");
  return new AnthropicProvider();
}

async function runOne(peon: ResolvedPeon, files: ChangeSet["files"], cfg: ResolvedConfig, provider: Provider, cache: FindingsCache | null):
  Promise<{ status: PeonRunStatus; findings: Finding[]; dropped: DroppedItem[]; redactions: number }> {
  const t0 = Date.now();
  const base = { name: peon.name, version: peon.version };
  try {
    const built = await buildContextPack(peon, files, cfg.root, cfg.budget.tokensPerPeon);
    const { pack, count: redactions } = redactPack(built);
    const model = cfg.models[peon.manifest.model.tier];
    const key = cacheKey(peon.hash, pack.hash, model);
    const hit = cache ? await cache.get(key) : null;
    if (hit) return { status: { ...base, status: "cached", durationMs: Date.now() - t0, findings: hit.length }, findings: hit, dropped: pack.dropped, redactions };
    const out = await provider.review(buildReviewInput(pack, model));
    const { findings, dropped } = postFilter(out.raw, pack);
    if (cache) await cache.set(key, findings);
    return { status: { ...base, status: "ok", usage: out.usage, durationMs: Date.now() - t0, findings: findings.length }, findings, dropped: [...pack.dropped, ...dropped], redactions };
  } catch (e) {
    if (e instanceof EngineError && e.code === "PERMISSION") throw e;   // a permission violation fails the whole run
    return { status: { ...base, status: "error", error: (e as Error).message, durationMs: Date.now() - t0, findings: 0 }, findings: [], dropped: [], redactions: 0 };
  }
}

export async function run(opts: RunOptions): Promise<RunResult> {
  const t0 = Date.now(); const emit = opts.onEvent ?? (() => {});
  const cfg = opts.config ?? (await loadConfig(opts.root));
  const changes = await computeChangeSet(opts.root, opts.scope);
  const plan = await (opts.planner ?? new PathPlanner()).plan(cfg, changes, { names: opts.names, allFiles: opts.allFiles });
  emit({ type: "plan", plan });
  const runRef: RunRef = { tenant: "local", repo: basename(opts.root), sha: changes.sha, base: changes.base, surface: opts.surface };
  const journal = new Journal(join(opts.root, ".peons", "journal"), cfg.journal);
  await journal.append({ type: "plan", at: new Date().toISOString(), run: runRef, peons: plan.entries.map((e) => ({ name: e.peon, version: cfg.peons.find((p) => p.name === e.peon)!.version, files: e.files.map((f) => f.path), reasons: e.files.map((f) => f.reason) })) });
  const provider = plan.entries.length ? (opts.provider ?? (await defaultProvider())) : (opts.provider ?? null);
  const cache = opts.noCache ? null : new FindingsCache(join(opts.root, ".peons", "cache"));
  const byPath = new Map(changes.files.map((f) => [f.path, f]));
  const results = await Promise.all(plan.entries.map(async (entry) => {
    const peon = cfg.peons.find((p) => p.name === entry.peon)!;
    emit({ type: "peon:start", name: peon.name, version: peon.version, files: entry.files.length });
    const r = await runOne(peon, entry.files.map((f) => byPath.get(f.path)!), cfg, provider!, cache);
    emit({ type: "peon:done", status: r.status });
    return r;
  }));
  const allFindings = results.flatMap((r) => r.findings);
  const findings = mergeFindings(allFindings);
  const peons = results.map((r) => r.status);
  const blockFor = (f: Finding): Severity => opts.failOn ?? cfg.peons.find((p) => p.name === f.peon.name)!.block;
  // Evaluated over the pre-merge findings so each finding is judged against its own peon's
  // threshold; merging keeps only one duplicate and would otherwise make the exit code depend
  // on peons.yaml order when two peons report the same finding at the same severity.
  const exit: 0 | 1 | 2 = peons.some((p) => p.status === "error") ? 2 : allFindings.some((f) => atLeast(f.severity, blockFor(f))) ? 1 : 0;
  const result: RunResult = {
    plan, findings, peons, redactions: results.reduce((n, r) => n + r.redactions, 0),
    dropped: results.flatMap((r) => r.dropped), exit, durationMs: Date.now() - t0,
  };
  for (const f of findings) await journal.append({ type: "finding", at: new Date().toISOString(), run: runRef, peon: f.peon, id: f.fingerprint.slice(0, 16), file: f.file, range: f.range, check: f.check, severity: f.severity, evidence: f.evidence, fingerprint: f.fingerprint });
  await journal.append({ type: "run_complete", at: new Date().toISOString(), run: runRef, findings: findings.length, cost_usd: 0, duration_ms: result.durationMs, exit });
  emit({ type: "done", result });
  return result;
}
