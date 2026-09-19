import { z } from "zod";
import { createHash } from "node:crypto";
import { SeveritySchema, type Severity } from "./severity.ts";

export const RawFindingSchema = z.object({
  check: z.string().describe("The check id from the peon's ## Checks section"),
  file: z.string().describe("Path exactly as given in the <file> tag"),
  range: z.tuple([z.number().int().min(1), z.number().int().min(1)]).describe("1-based inclusive start and end line in the post-change file"),
  severity: SeveritySchema.optional().describe("Omit to use the peon default"),
  message: z.string().min(1).max(600).describe("One to three sentences stating the problem"),
  evidence: z.array(z.string()).min(1).max(8).describe("The offending lines, verbatim"),
  fix: z.string().max(1200).optional().describe("A suggested change, prose or a short snippet"),
});
export const RawFindingsSchema = z.object({ findings: z.array(RawFindingSchema) });
export type RawFinding = z.infer<typeof RawFindingSchema>;

export type PeonRef = { name: string; version: string; hash: string };
export type Finding = {
  peon: PeonRef; check: string; file: string; range: [number, number]; severity: Severity;
  message: string; evidence: string[]; fix?: string; fingerprint: string;
};

export function fingerprint(check: string, evidence: string[]): string {
  const norm = evidence.map((l) => l.replace(/\s+/g, " ").trim()).join("\n");
  return createHash("sha256").update(check + "\n" + norm).digest("hex");
}
