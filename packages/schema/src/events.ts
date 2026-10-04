import type { Severity } from "./severity.ts";
import type { PeonRef } from "./finding.ts";
import type { BossInfo } from "./run.ts";
export type RunRef = { tenant: string; repo: string; sha: string; base?: string; surface: "ci" | "cli" | "mcp" };
export type PeonEvent =
  | { type: "plan"; at: string; run: RunRef; peons: Array<{ name: string; version: string; files: string[]; reasons: string[] }>; boss?: BossInfo }
  | { type: "finding"; at: string; run: RunRef; peon: PeonRef; id: string; file: string; range: [number, number];
      check: string; severity: Severity; evidence: string[]; fingerprint: string }
  | { type: "run_complete"; at: string; run: RunRef; findings: number; cost_usd: number; duration_ms: number; exit: 0 | 1 | 2 };
