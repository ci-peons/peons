import picomatch from "picomatch";
import type { Plan } from "@peons/schema";
import type { ResolvedConfig } from "./config.ts";
import type { ChangeSet } from "./changeset.ts";

export type PlanOptions = { names?: string[]; allFiles?: boolean };
export interface Planner { plan(config: ResolvedConfig, changes: ChangeSet, opts?: PlanOptions): Promise<Plan>; }

export class PathPlanner implements Planner {
  async plan(config: ResolvedConfig, changes: ChangeSet, opts: PlanOptions = {}): Promise<Plan> {
    const plan: Plan = { entries: [], skipped: [] };
    const wanted = opts.names ? new Set(opts.names) : null;
    if (wanted) for (const n of wanted) if (!config.peons.some((p) => p.name === n)) plan.skipped.push({ peon: n, reason: "not configured in peons.yaml" });
    for (const peon of config.peons) {
      if (wanted && !wanted.has(peon.name)) continue;
      if (!peon.enabled) { plan.skipped.push({ peon: peon.name, reason: `disabled: ${peon.reason}` }); continue; }
      if (wanted && opts.allFiles) { plan.entries.push({ peon: peon.name, files: changes.files.map((f) => ({ path: f.path, reason: "named with --all-files" })) }); continue; }
      const matchers = peon.paths.map((g) => ({ g, m: picomatch(g, { dot: true }) }));
      const files = changes.files.flatMap((f) => { const hit = matchers.find((x) => x.m(f.path)); return hit ? [{ path: f.path, reason: `matched ${hit.g}` }] : []; });
      if (files.length) plan.entries.push({ peon: peon.name, files });
      else plan.skipped.push({ peon: peon.name, reason: `no changed file matched ${peon.paths.join(", ")}` });
    }
    return plan;
  }
}
