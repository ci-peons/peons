import { readFile } from "node:fs/promises";
import { join, resolve, isAbsolute } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  parsePeonFile, PeonParseError, SeveritySchema, ModelTierSchema,
  type PeonManifest, type PeonCheck, type ModelTier, type Severity,
} from "@peons/schema";
import { EngineError } from "./errors.ts";
import { hashPeonDir, isDir } from "./pack.ts";

export const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5-20251001", balanced: "claude-sonnet-5", deep: "claude-opus-5",
};

const ConfigFileSchema = z.object({
  provider: z.literal("anthropic").default("anthropic"),
  model: z.partialRecord(ModelTierSchema, z.string()).default({}),
  budget: z.object({ tokens_per_peon: z.number().int().positive().default(60000) }).default({ tokens_per_peon: 60000 }),
  journal: z.boolean().default(true),
  peons: z.array(z.object({
    use: z.string().min(1),
    paths: z.array(z.string()).min(1).optional(),
    severity: z.object({ block: SeveritySchema }).optional(),
    enabled: z.boolean().default(true),
    reason: z.string().optional(),
  })).default([]),
});
const LockSchema = z.object({
  lockfile: z.literal(1),
  registry: z.string().optional(),
  packages: z.record(z.string(), z.object({
    version: z.string(), integrity: z.string(), permissions: z.object({ read: z.array(z.string()) }),
  })).default({}),
});

export type PeonSource = { kind: "local"; dir: string } | { kind: "installed"; dir: string; version: string; integrity: string };
export type ResolvedPeon = {
  name: string; version: string; hash: string; dir: string; source: PeonSource;
  manifest: PeonManifest; guidance: string; checks: PeonCheck[]; body: string;
  paths: string[]; block: Severity; enabled: boolean; reason?: string;
};
export type ResolvedConfig = {
  root: string; provider: "anthropic"; models: Record<ModelTier, string>;
  budget: { tokensPerPeon: number }; journal: boolean; peons: ResolvedPeon[];
};

async function readYaml<T>(path: string, schema: z.ZodType<T>, what: string): Promise<T | null> {
  let text: string;
  try { text = await readFile(path, "utf8"); } catch { return null; }
  let data: unknown;
  try { data = parseYaml(text); } catch (e) { throw new EngineError("CONFIG_YAML", `${what}: ${(e as Error).message}`); }
  const r = schema.safeParse(data ?? {});
  if (!r.success) throw new EngineError("CONFIG_INVALID", `${what}: ` + r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return r.data;
}

async function loadPeonDir(dir: string, use: string) {
  const file = join(dir, "peon.md");
  let raw: string;
  try { raw = await readFile(file, "utf8"); } catch { throw new EngineError("PEON_MISSING", `peon "${use}": no peon.md at ${file}`); }
  try { return parsePeonFile(raw); }
  catch (e) { if (e instanceof PeonParseError) throw new EngineError("PEON_INVALID", `peon "${use}": ${e.issues.join("; ")}`); throw e; }
}

export async function loadConfig(root: string): Promise<ResolvedConfig> {
  const cfg = await readYaml(join(root, "peons.yaml"), ConfigFileSchema, "peons.yaml");
  if (!cfg) throw new EngineError("CONFIG_MISSING", `no peons.yaml in ${root}. Run "peons init".`);
  const lock = (await readYaml(join(root, "peons.lock"), LockSchema, "peons.lock")) ?? { lockfile: 1 as const, packages: {} };
  const peons: ResolvedPeon[] = [];
  for (const entry of cfg.peons) {
    if (!entry.enabled && !entry.reason) throw new EngineError("CONFIG_INVALID", `peon "${entry.use}" is disabled without a reason`);
    let source: PeonSource; let hash: string;
    if (entry.use.startsWith("./") || entry.use.startsWith("../") || isAbsolute(entry.use)) {
      const dir = resolve(root, entry.use);
      if (!(await isDir(dir))) throw new EngineError("PEON_MISSING", `peon "${entry.use}": directory not found`);
      source = { kind: "local", dir }; hash = await hashPeonDir(dir);
    } else {
      const locked = lock.packages[entry.use];
      if (!locked) throw new EngineError("LOCK_MISSING", `peon "${entry.use}" is not in peons.lock. Run "peons add ${entry.use}".`);
      const dir = join(root, ".peons", "installed", entry.use, locked.version);
      if (!(await isDir(dir))) throw new EngineError("PEON_MISSING", `peon "${entry.use}@${locked.version}" is not installed. Run "peons add ${entry.use}".`);
      hash = await hashPeonDir(dir);
      if (hash !== locked.integrity) throw new EngineError("LOCK_MISMATCH", `peon "${entry.use}@${locked.version}": installed content does not match peons.lock integrity. Run "peons add ${entry.use}".`);
      source = { kind: "installed", dir, version: locked.version, integrity: locked.integrity };
    }
    const file = await loadPeonDir(source.dir, entry.use);
    if (source.kind === "installed") {
      const a = JSON.stringify(file.manifest.permissions.read), b = JSON.stringify(lock.packages[entry.use]!.permissions.read);
      if (a !== b) throw new EngineError("LOCK_MISMATCH", `peon "${entry.use}": permissions on disk differ from peons.lock`);
    }
    peons.push({
      name: file.manifest.name, version: file.manifest.version, hash, dir: source.dir, source,
      manifest: file.manifest, guidance: file.guidance, checks: file.checks, body: file.body,
      paths: entry.paths ?? file.manifest.paths,
      block: entry.severity?.block ?? file.manifest.severity.block,
      enabled: entry.enabled, reason: entry.reason,
    });
  }
  return {
    root, provider: cfg.provider, models: { ...DEFAULT_MODELS, ...cfg.model },
    budget: { tokensPerPeon: cfg.budget.tokens_per_peon }, journal: cfg.journal, peons,
  };
}
