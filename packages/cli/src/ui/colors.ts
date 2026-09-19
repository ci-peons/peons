import pc from "picocolors";
import type { Severity } from "@peons/schema";
export function severityColor(s: Severity): (t: string) => string {
  return { critical: pc.red, high: (t: string) => pc.yellow(pc.bold(t)), medium: pc.yellow, low: pc.blue, info: pc.dim }[s];
}
export const INK_COLOR: Record<Severity, string> = { critical: "red", high: "yellowBright", medium: "yellow", low: "blue", info: "gray" };
