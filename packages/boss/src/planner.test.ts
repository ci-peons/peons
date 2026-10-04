import { test, expect } from "bun:test";
import { BossPlanner } from "./planner.ts";
import { FakeDecisionProvider } from "./decision/fake.ts";
import type { ResolvedConfig, ResolvedPeon, ChangeSet, ChangedFile } from "@peons/core";
import type { DecisionAnswer } from "./decision/types.ts";

const P = (name: string, paths: string[], triggers: string[] = []): ResolvedPeon => ({ name, version: "1.0.0", hash: "h", dir: "/x", source: { kind: "local", dir: "/x" }, manifest: { description: `${name} reviewer`, triggers, permissions: { read: ["**"] }, context: { docs: [], tests: [] }, severity: { default: "medium", block: "high" }, model: { tier: "fast" }, name, version: "1.0.0", paths } as never, guidance: "", checks: [], body: "", paths, block: "high", enabled: true });
const cf = (path: string, added = "+x"): ChangedFile => ({ path, status: "modified", content: "", hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, text: `@@ -1 +1 @@\n${added}` }] });
const cfg = (peons: ResolvedPeon[], boss: Partial<ResolvedConfig["boss"]> = {}): ResolvedConfig => ({ root: "/r", provider: "anthropic", models: {} as never, budget: { tokensPerPeon: 1 }, journal: false, peons, boss: { enabled: true, provider: "auto", model: "jev-latest", budget: { maxPeons: 5 }, always: [], neverSkip: [], thresholds: { dispatch: 0.7, prune: 0.15 }, ...boss } });
const changes = (...files: ChangedFile[]) => ({ files, warnings: [], sha: "s", scope: { kind: "files", paths: [] } } as unknown as ChangeSet);
const nouls = (m: Record<string, number>, risk = 1) => (): Record<string, DecisionAnswer> => ({ ...Object.fromEntries(Object.entries(m).map(([k, v]) => [`peon:${k}`, { type: "noul", noul: v }])), risk: { type: "score", score: risk, confidence: 1, probabilities: { [String(risk)]: 1 } } });

test("settled plan skips the decision call", async () => {
  const fake = new FakeDecisionProvider(nouls({ a11y: 0.9 }));
  const plan = await new BossPlanner({ provider: fake }).plan(cfg([P("a11y", ["**/*.tsx"])]), changes(cf("a.tsx")));
  expect(fake.calls).toHaveLength(0);
  expect(plan.entries.map((e) => e.peon)).toEqual(["a11y"]);
  expect(plan.boss).toEqual({ provider: "none", probabilities: {}, decisionSkipped: "decision skipped: plan settled" });
});
test("unplanned peon above dispatch is added with all files and reason intent p=", async () => {
  const fake = new FakeDecisionProvider(nouls({ a11y: 0.9, sql: 0.82 }, 2));
  const plan = await new BossPlanner({ provider: fake, intent: "Add query" }).plan(cfg([P("a11y", ["**/*.tsx"]), P("sql", ["db/**"])]), changes(cf("a.tsx"), cf("b.tsx")));
  expect(fake.calls).toHaveLength(1);
  const sql = plan.entries.find((e) => e.peon === "sql")!;
  expect(sql.files).toEqual([{ path: "a.tsx", reason: "intent p=0.82" }, { path: "b.tsx", reason: "intent p=0.82" }]);
  expect(plan.boss).toMatchObject({ provider: "fake", model: "fake", risk: 2, intent: "Add query", probabilities: { a11y: 0.9, sql: 0.82 } });
});
test("planned peon at or below prune is removed unless protected", async () => {
  const peons = [P("a11y", ["**/*.tsx"]), P("react", ["**/*.tsx"]), P("sql", ["db/**"])];
  const fake = () => new FakeDecisionProvider(nouls({ a11y: 0.1, react: 0.9, sql: 0.2 }));
  const p1 = await new BossPlanner({ provider: fake() }).plan(cfg(peons), changes(cf("a.tsx")));
  expect(p1.entries.map((e) => e.peon)).toEqual(["react"]);
  expect(p1.skipped).toContainEqual({ peon: "a11y", reason: "pruned p=0.10" });
  const p2 = await new BossPlanner({ provider: fake() }).plan(cfg(peons, { always: ["a11y"] }), changes(cf("a.tsx")));
  expect(p2.entries.map((e) => e.peon).sort()).toEqual(["a11y", "react"]);
  const p3 = await new BossPlanner({ provider: fake() }).plan(cfg(peons, { neverSkip: ["a.tsx"] }), changes(cf("a.tsx")));
  expect(p3.entries.map((e) => e.peon).sort()).toEqual(["a11y", "react"]);
});
test("triggers plan a peon outside its paths", async () => {
  const plan = await new BossPlanner({ provider: null }).plan(cfg([P("a11y", ["**/*.tsx"]), P("sec", ["server/**"], ["innerHTML"])]), changes(cf("a.tsx", "+el.innerHTML = raw")));
  expect(plan.entries.find((e) => e.peon === "sec")!.files).toEqual([{ path: "a.tsx", reason: "trigger /innerHTML/ matched a.tsx:1" }]);
  expect(plan.boss!.decisionSkipped).toBe("decision skipped: plan settled");
});
test("always is added when missing; budget cuts lowest probability first, protected kept", async () => {
  const peons = [P("a", ["**"]), P("b", ["**"]), P("c", ["**"]), P("d", ["db/**"])];
  const fake = new FakeDecisionProvider(nouls({ a: 0.3, b: 0.9, c: 0.5, d: 0.95 }));
  const plan = await new BossPlanner({ provider: fake }).plan(cfg(peons, { budget: { maxPeons: 2 }, always: ["a"] }), changes(cf("x.ts")));
  expect(plan.entries.map((e) => e.peon).sort()).toEqual(["a", "d"]);
  expect(plan.skipped).toContainEqual({ peon: "c", reason: "over budget (max 2), p=0.50" });
  expect(plan.skipped).toContainEqual({ peon: "b", reason: "over budget (max 2), p=0.90" });
});
test("provider failure degrades to a deterministic plan", async () => {
  const fake = new FakeDecisionProvider(() => new Error("boom"));
  const plan = await new BossPlanner({ provider: fake }).plan(cfg([P("a11y", ["**/*.tsx"]), P("sql", ["db/**"])]), changes(cf("a.tsx")));
  expect(plan.entries.map((e) => e.peon)).toEqual(["a11y"]);
  expect(plan.boss).toMatchObject({ provider: "none", decisionSkipped: "decision unavailable: boom" });
});
test("oversized state skips the decision", async () => {
  const fake = new FakeDecisionProvider(nouls({ a11y: 0.9, sql: 0.9 }));
  const files = Array.from({ length: 200 }, (_, i) => cf(`${"p".repeat(150)}/${i}.tsx`));
  const plan = await new BossPlanner({ provider: fake }).plan(cfg([P("a11y", ["**/*.tsx"]), P("sql", ["db/**"])]), changes(...files));
  expect(fake.calls).toHaveLength(0); expect(plan.boss!.decisionSkipped).toBe("state too large");
});
test("names option restricts candidates like PathPlanner", async () => {
  const fake = new FakeDecisionProvider(nouls({ a11y: 0.9, sql: 0.9 }));
  const plan = await new BossPlanner({ provider: fake }).plan(cfg([P("a11y", ["**/*.tsx"]), P("sql", ["db/**"])]), changes(cf("a.tsx")), { names: ["sql"] });
  expect(plan.entries.map((e) => e.peon)).toEqual(["sql"]);
});
