import { z } from "zod";
import semver from "semver";
import { SeveritySchema, atLeast } from "./severity.ts";
import { validatePeonName } from "./name.ts";
import { isCoveredBy } from "./glob.ts";

export const ModelTierSchema = z.enum(["fast", "balanced", "deep"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

/** A glob must stay inside the repository: no absolute path, no ".." segment. */
export function isContainedGlob(g: string): boolean {
  return !g.startsWith("/") && !/^\.\.(\/|$)/.test(g) && !/\/\.\.(\/|$)/.test(g);
}
const CONTAINED_MESSAGE = 'globs must be relative to the repository and must not contain ".."';
const GlobString = z.string().min(1).refine(isContainedGlob, { message: CONTAINED_MESSAGE });
const Globs = z.array(GlobString).min(1);

// A quantified group whose own body ends in a quantifier -- (a+)+, (\w*)*, (a{2,})+ -- is the
// classic catastrophic-backtracking shape: matching it against a long non-matching line can take
// exponential time, and triggers run on every added line of every changed file.
const NESTED_QUANTIFIER = /\([^()]*[+*}][^()]*\)\s*[+*{?]/;
export function isValidTrigger(p: string): boolean {
  if (p.length === 0 || p.length > 200) return false;
  if (NESTED_QUANTIFIER.test(p)) return false;
  try { new RegExp(p); return true; } catch { return false; }
}
const Trigger = z.string().refine(isValidTrigger, { message: "trigger must be a valid regular expression of at most 200 characters without nested quantifiers" });

export const PeonManifestSchema = z.object({
  name: z.string().refine((n) => validatePeonName(n).ok, { message: "invalid peon name" }),
  version: z.string().refine((v) => semver.valid(v) !== null, { message: "version must be semver" }),
  description: z.string().min(1).max(300),
  paths: Globs,
  severity: z.object({ default: SeveritySchema.default("medium"), block: SeveritySchema.default("high") }).default({ default: "medium", block: "high" }),
  permissions: z.object({ read: Globs }),
  context: z.object({
    docs: z.array(GlobString).default([]),
    tests: z.array(GlobString).default([]),
  }).default({ docs: [], tests: [] }),
  model: z.object({ tier: ModelTierSchema.default("fast") }).default({ tier: "fast" }),
  triggers: z.array(Trigger).max(32).default([]),
}).superRefine((m, ctx) => {
  if (!atLeast(m.severity.block, m.severity.default)) {
    ctx.addIssue({ code: "custom", path: ["severity", "block"], message: "block must be at or above default" });
  }
  for (const [field, globs] of [["docs", m.context.docs], ["tests", m.context.tests]] as const) {
    for (const g of globs) {
      if (!isCoveredBy(g, m.permissions.read)) {
        ctx.addIssue({ code: "custom", path: ["context", field], message: `context glob "${g}" is not covered by permissions.read` });
      }
    }
  }
});
export type PeonManifest = z.infer<typeof PeonManifestSchema>;
