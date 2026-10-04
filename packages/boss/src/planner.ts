import picomatch from "picomatch";
import type { Plan, PlanEntry, BossInfo } from "@peons/schema";
import { PathPlanner, type Planner, type PlanOptions, type ResolvedConfig, type ChangeSet } from "@peons/core";
import type { DecisionProvider, DecisionAnswer } from "./decision/types.ts";
import { matchTriggers } from "./triggers.ts";
import { buildDecisionState, buildQuestions, estimateStateTokens, MAX_STATE_TOKENS } from "./state.ts";

export type BossPlannerOptions = { provider: DecisionProvider | null; intent?: string };
export const fmtP = (p: number) => p.toFixed(2);

export class BossPlanner implements Planner {
  constructor(private opts: BossPlannerOptions) {}

  async plan(config: ResolvedConfig, changes: ChangeSet, opts: PlanOptions = {}): Promise<Plan> {
    const boss = config.boss;
    const wanted = opts.names ? new Set(opts.names) : null;
    const candidates = config.peons.filter((p) => p.enabled && (!wanted || wanted.has(p.name)));
    // 1. paths
    const base = await new PathPlanner().plan(config, changes, opts);
    const entries = new Map<string, PlanEntry>(base.entries.map((e) => [e.peon, e]));
    const skipped = base.skipped.filter((s) => !candidates.some((p) => p.name === s.peon));   // keep "not configured"/"disabled"; drop path misses, re-decided below
    const allFiles = (reason: string) => changes.files.map((f) => ({ path: f.path, reason }));
    // 2. triggers
    const hits = matchTriggers(candidates, changes);
    for (const h of hits) {
      const e = entries.get(h.peon) ?? { peon: h.peon, files: [] };
      if (!e.files.some((f) => f.path === h.file)) e.files.push({ path: h.file, reason: `trigger /${h.pattern}/ matched ${h.file}:${h.line}` });
      entries.set(h.peon, e);
    }
    // 3. decision
    const info: BossInfo = { provider: "none", probabilities: {} };
    if (this.opts.intent) info.intent = this.opts.intent;
    const unplanned = candidates.filter((p) => !entries.has(p.name));
    const needDecision = unplanned.length > 0 || entries.size > boss.budget.maxPeons;
    const protectedSet = new Set<string>();
    const neverSkip = boss.neverSkip.map((g) => picomatch(g, { dot: true }));
    const isProtected = (name: string) => boss.always.includes(name) || (entries.get(name)?.files.some((f) => neverSkip.some((m) => m(f.path))) ?? false);
    if (!needDecision) info.decisionSkipped = "decision skipped: plan settled";
    else if (!this.opts.provider) info.decisionSkipped = "decision unavailable: no provider";
    else {
      const state = buildDecisionState(changes, candidates, hits, this.opts.intent);
      if (estimateStateTokens(state) > MAX_STATE_TOKENS) info.decisionSkipped = "state too large";
      else {
        try {
          const res = await this.opts.provider.decide(state, buildQuestions(candidates));
          info.provider = this.opts.provider.kind as BossInfo["provider"]; info.model = res.model;
          const risk = res.answers.risk; if (risk && risk.type === "score") info.risk = risk.score;
          for (const p of candidates) {
            const a: DecisionAnswer | undefined = res.answers[`peon:${p.name}`];
            if (!a || a.type !== "noul") continue;
            info.probabilities[p.name] = a.noul;
            if (!entries.has(p.name) && a.noul >= boss.thresholds.dispatch) entries.set(p.name, { peon: p.name, files: allFiles(`intent p=${fmtP(a.noul)}`) });
            else if (entries.has(p.name) && a.noul <= boss.thresholds.prune && !isProtected(p.name)) { entries.delete(p.name); skipped.push({ peon: p.name, reason: `pruned p=${fmtP(a.noul)}` }); }
          }
        } catch (e) { info.decisionSkipped = `decision unavailable: ${(e as Error).message}`; }
      }
    }
    // 4. hard rules
    for (const name of boss.always) if (candidates.some((p) => p.name === name) && !entries.has(name)) entries.set(name, { peon: name, files: allFiles("always") });
    for (const name of entries.keys()) if (isProtected(name)) protectedSet.add(name);
    // 5. budget
    if (entries.size > boss.budget.maxPeons) {
      const rank = (name: string) => info.probabilities[name] ?? -1;
      const cuttable = [...entries.keys()].filter((n) => !protectedSet.has(n)).sort((a, b) => rank(b) - rank(a) || a.localeCompare(b));
      const keep = Math.max(0, boss.budget.maxPeons - protectedSet.size);
      for (const name of cuttable.slice(keep)) { entries.delete(name); const p = info.probabilities[name]; skipped.push({ peon: name, reason: `over budget (max ${boss.budget.maxPeons})${p !== undefined ? `, p=${fmtP(p)}` : ""}` }); }
    }
    for (const p of candidates) if (!entries.has(p.name) && !skipped.some((s) => s.peon === p.name)) skipped.push({ peon: p.name, reason: info.probabilities[p.name] !== undefined ? `not dispatched p=${fmtP(info.probabilities[p.name]!)}` : `no changed file matched ${p.paths.join(", ")}` });
    return { entries: [...entries.values()], skipped, boss: info };
  }
}
