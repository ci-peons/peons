import type { Finding } from "./finding.ts";
export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; costUsd?: number };
export type PlanEntry = { peon: string; files: Array<{ path: string; reason: string }> };
export type Plan = { entries: PlanEntry[]; skipped: Array<{ peon: string; reason: string }> };
export type PeonRunStatus = {
  name: string; version: string; status: "ok" | "cached" | "error" | "skipped";
  error?: string; usage?: Usage; durationMs: number; findings: number;
};
export type DroppedItem = { peon: string; item: string; reason: string };
export type RunResult = {
  plan: Plan; findings: Finding[]; peons: PeonRunStatus[]; redactions: number;
  dropped: DroppedItem[]; exit: 0 | 1 | 2; durationMs: number;
};
export type CheckScore = {
  peon: string; check: string; expected: number; fired: number; truePositives: number;
  recall: number | null; precision: number | null;
};
export type TestResult = {
  checks: CheckScore[]; precision: number; recall: number; passed: boolean; failures: string[]; peons: PeonRunStatus[];
};
