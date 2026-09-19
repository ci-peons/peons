import { z } from "zod";
import semver from "semver";
import { SeveritySchema, atLeast } from "./severity.ts";
import { validatePeonName } from "./name.ts";
import { isCoveredBy } from "./glob.ts";

export const ModelTierSchema = z.enum(["fast", "balanced", "deep"]);
export type ModelTier = z.infer<typeof ModelTierSchema>;

const Globs = z.array(z.string().min(1)).min(1);

export const PeonManifestSchema = z.object({
  name: z.string().refine((n) => validatePeonName(n).ok, { message: "invalid peon name" }),
  version: z.string().refine((v) => semver.valid(v) !== null, { message: "version must be semver" }),
  description: z.string().min(1).max(300),
  paths: Globs,
  severity: z.object({ default: SeveritySchema.default("medium"), block: SeveritySchema.default("high") }).default({ default: "medium", block: "high" }),
  permissions: z.object({ read: Globs }),
  context: z.object({
    docs: z.array(z.string().min(1)).default([]),
    tests: z.array(z.string().min(1)).default([]),
  }).default({ docs: [], tests: [] }),
  model: z.object({ tier: ModelTierSchema.default("fast") }).default({ tier: "fast" }),
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
