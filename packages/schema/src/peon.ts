import { parse as parseYaml } from "yaml";
import { PeonManifestSchema, type PeonManifest } from "./manifest.ts";
import { parsePeonBody, PeonParseError, type PeonCheck } from "./body.ts";
export { PeonParseError };

export type PeonFile = { manifest: PeonManifest; body: string; guidance: string; checks: PeonCheck[]; raw: string };

export function splitFrontmatter(raw: string): { yaml: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) throw new PeonParseError(["peon.md must start with YAML frontmatter delimited by ---"]);
  return { yaml: m[1]!, body: m[2]! };
}

export function parsePeonFile(raw: string): PeonFile {
  const { yaml, body } = splitFrontmatter(raw);
  let data: unknown;
  try { data = parseYaml(yaml); } catch (e) { throw new PeonParseError([`frontmatter YAML: ${(e as Error).message}`]); }
  const parsed = PeonManifestSchema.safeParse(data);
  if (!parsed.success) throw new PeonParseError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const { guidance, checks } = parsePeonBody(body);
  return { manifest: parsed.data, body: body.trim(), guidance, checks, raw };
}
