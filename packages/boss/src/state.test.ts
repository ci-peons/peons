import { test, expect } from "bun:test";
import { buildDecisionState, buildQuestions, estimateStateTokens, countAddedRemoved, MAX_STATE_FILES } from "./state.ts";
import type { ResolvedPeon } from "@peons/core";
import type { ChangeSet, ChangedFile } from "@peons/core";

const P = (name: string, description: string) => ({ name, version: "1.0.0", hash: "h", dir: "/x", source: { kind: "local", dir: "/x" }, manifest: { description, triggers: [] }, guidance: "", checks: [], body: "", paths: ["**"], block: "high", enabled: true } as unknown as ResolvedPeon);
const cf = (path: string, plus: number, minus: number): ChangedFile => ({ path, status: "modified", content: "", hunks: [{ oldStart: 1, oldLines: minus, newStart: 1, newLines: plus, text: ["@@ -1 +1 @@", ...Array(plus).fill("+a"), ...Array(minus).fill("-b")].join("\n") }] });

test("counts added and removed from hunks, excluding headers", () => {
  expect(countAddedRemoved(cf("a.ts", 3, 2))).toEqual({ added: 3, removed: 2 });
  const withHeaders: ChangedFile = { path: "b.ts", status: "added", content: "", hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: 1, text: "--- a/b.ts\n+++ b/b.ts\n@@ -0,0 +1 @@\n+x" }] };
  expect(countAddedRemoved(withHeaders)).toEqual({ added: 1, removed: 0 });
});
test("state has files, reviewers, hits and optional intent; never content", () => {
  const s = buildDecisionState({ files: [cf("src/a.tsx", 5, 1)] } as ChangeSet, [P("a11y", "WCAG checks")], [{ peon: "a11y", pattern: "x", file: "src/a.tsx", line: 3 }], "Fix alt text");
  expect(s).toEqual({ intent: "Fix alt text", files: [{ path: "src/a.tsx", status: "modified", added: 5, removed: 1 }], triggers_hit: [{ peon: "a11y", pattern: "x", file: "src/a.tsx" }], reviewers: [{ name: "a11y", description: "WCAG checks" }] });
  expect(JSON.stringify(s)).not.toContain("content");
});
test("truncates to the largest 200 files and flags it", () => {
  const files = Array.from({ length: 250 }, (_, i) => cf(`f${i}.ts`, i, 0));
  const s = buildDecisionState({ files } as ChangeSet, [], []);
  expect(s.files).toHaveLength(MAX_STATE_FILES); expect(s.files_truncated).toBe(true); expect(s.files[0]!.path).toBe("f249.ts");
});
test("questions: one noul per peon plus risk score with four levels", () => {
  const q = buildQuestions([P("a11y", "WCAG checks"), P("react", "React correctness")]);
  expect(Object.keys(q)).toEqual(["peon:a11y", "peon:react", "risk"]);
  expect(q["peon:a11y"]).toMatchObject({ type: "noul", criteria: { true: expect.any(String), false: expect.any(String) } });
  expect((q["peon:a11y"] as { instructions: string }).instructions).toContain("WCAG checks");
  expect(q.risk).toMatchObject({ type: "score" }); expect((q.risk as { criteria: string[] }).criteria).toHaveLength(4);
});
test("token estimate is chars/4", () => { expect(estimateStateTokens({ files: [], triggers_hit: [], reviewers: [] })).toBe(Math.ceil(JSON.stringify({ files: [], triggers_hit: [], reviewers: [] }).length / 4)); });
