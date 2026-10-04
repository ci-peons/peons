import type { ChangeSet, ChangedFile, ResolvedPeon } from "@peons/core";
import type { DecisionQuestion } from "./decision/types.ts";

export type StateFile = { path: string; status: string; added: number; removed: number };
export type TriggerHit = { peon: string; pattern: string; file: string; line: number };
export type DecisionState = {
  intent?: string;
  files: StateFile[];
  files_truncated?: true;
  triggers_hit: Array<{ peon: string; pattern: string; file: string }>;
  reviewers: Array<{ name: string; description: string }>;
};
export const MAX_STATE_FILES = 200;
export const MAX_STATE_TOKENS = 8000;
export const MAX_INTENT_CHARS = 500;
export const RISK_LEVELS = [
  "Docs, comments, tests or formatting only",
  "Ordinary feature or fix in application code",
  "Shared library, build, dependency or configuration change",
  "Auth, payments, data deletion, secrets or infrastructure",
] as const;

export function countAddedRemoved(f: ChangedFile): { added: number; removed: number } {
  let added = 0, removed = 0;
  for (const h of f.hunks) for (const l of h.text.split("\n")) {
    if (l.startsWith("+++") || l.startsWith("---") || l.startsWith("@@")) continue;
    if (l.startsWith("+")) added++; else if (l.startsWith("-")) removed++;
  }
  return { added, removed };
}

export function buildDecisionState(changes: ChangeSet, peons: ResolvedPeon[], hits: TriggerHit[], intent?: string): DecisionState {
  let files: StateFile[] = changes.files.map((f) => ({ path: f.path, status: f.status, ...countAddedRemoved(f) }));
  let truncated = false;
  if (files.length > MAX_STATE_FILES) {
    files = [...files].sort((a, b) => (b.added + b.removed) - (a.added + a.removed)).slice(0, MAX_STATE_FILES);
    truncated = true;
  }
  const state: DecisionState = {
    files,
    triggers_hit: hits.map(({ peon, pattern, file }) => ({ peon, pattern, file })),
    reviewers: peons.map((p) => ({ name: p.name, description: p.manifest.description })),
  };
  if (intent) state.intent = intent;
  if (truncated) state.files_truncated = true;
  return state;
}

export function estimateStateTokens(state: DecisionState): number {
  return Math.ceil(JSON.stringify(state).length / 4);
}

export function buildQuestions(peons: ResolvedPeon[]): Record<string, DecisionQuestion> {
  const q: Record<string, DecisionQuestion> = {};
  for (const p of peons) q[`peon:${p.name}`] = {
    type: "noul",
    instructions: `Would the "${p.name}" reviewer find issues worth a human's time in this change? Judge only from the file paths, change sizes, triggers and intent. Reviewer: ${p.manifest.description}`,
    criteria: { true: "The change plausibly touches what this reviewer checks.", false: "The change is unrelated to what this reviewer checks, or touches only files it would not read." },
  };
  q.risk = { type: "score", instructions: "How risky is this change if reviewed by nobody?", criteria: [...RISK_LEVELS] };
  return q;
}
