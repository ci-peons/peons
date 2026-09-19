import type { RunResult } from "@peons/schema";
export function formatJson(r: RunResult): string {
  return JSON.stringify(r, null, 2) + "\n";
}
