export * from "./agent.ts"; export * from "./json.ts"; export * from "./sarif.ts"; export * from "./github.ts";
import type { RunResult } from "@peons/schema";
import { formatAgent } from "./agent.ts"; import { formatJson } from "./json.ts"; import { formatSarif } from "./sarif.ts";
export type FormatName = "agent" | "json" | "sarif";
export const FORMATS: FormatName[] = ["agent", "json", "sarif"];
export function formatResult(r: RunResult, name: FormatName): string {
  return name === "agent" ? formatAgent(r) : name === "json" ? formatJson(r) : formatSarif(r);
}
