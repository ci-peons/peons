import { z } from "zod";
export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SeveritySchema = z.enum(SEVERITIES);
export function severityRank(s: Severity): number { return SEVERITIES.indexOf(s); }
export function atLeast(a: Severity, b: Severity): boolean { return severityRank(a) >= severityRank(b); }
