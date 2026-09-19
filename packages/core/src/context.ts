import { readFile } from "node:fs/promises";
import { join, dirname, basename, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import picomatch from "picomatch";
import { glob } from "tinyglobby";
import type { DroppedItem } from "@peons/schema";
import { EngineError } from "./errors.ts";
import type { ResolvedPeon } from "./config.ts";
import type { ChangedFile } from "./changeset.ts";

export type PackFile = { path: string; content: string };
export type PackChangedFile = ChangedFile & { hunksOnly: boolean };
export type ContextPack = {
  peon: ResolvedPeon; files: PackChangedFile[]; docs: PackFile[]; tests: PackFile[];
  dropped: DroppedItem[]; tokensEstimate: number; hash: string;
};
export class PermissionError extends EngineError { constructor(msg: string) { super("PERMISSION", msg); this.name = "PermissionError"; } }
export function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

async function globFiles(root: string, patterns: string[], limit: number): Promise<string[]> {
  const found = await glob(patterns, { cwd: root, dot: false, onlyFiles: true, ignore: [".peons/**", "node_modules/**", ".git/**"], expandDirectories: false });
  return [...new Set(found.map((f) => f.split("\\").join("/")))].sort().slice(0, limit);
}
/** True when `p`, resolved against `root`, stays inside `root`. */
export function isInsideRoot(root: string, p: string): boolean {
  const abs = resolve(root, p);
  return abs === root || abs.startsWith(root + sep);
}
function assertPermitted(peon: ResolvedPeon, root: string, path: string, allow: (p: string) => boolean) {
  if (!isInsideRoot(root, path)) throw new PermissionError(`peon "${peon.name}" may not read ${path}: outside the repository`);
  if (!allow(path)) throw new PermissionError(`peon "${peon.name}" may not read ${path}: not covered by permissions.read [${peon.manifest.permissions.read.join(", ")}]`);
}
function packTokens(files: PackChangedFile[], docs: PackFile[], tests: PackFile[], body: string): number {
  let n = estimateTokens(body);
  for (const f of files) n += estimateTokens(f.hunksOnly ? f.hunks.map((h) => h.text).join("\n") : f.content + f.hunks.map((h) => h.text).join("\n"));
  for (const d of docs) n += estimateTokens(d.content);
  for (const t of tests) n += estimateTokens(t.content);
  return n;
}
export function hashPack(p: Omit<ContextPack, "hash">): string {
  const h = createHash("sha256");
  h.update(p.peon.hash + "\n" + p.peon.body + "\n");
  for (const f of p.files) h.update(`F ${f.path} ${f.hunksOnly ? "hunks" : "full"}\n${f.hunksOnly ? "" : f.content}\n${f.hunks.map((x) => x.text).join("\n")}\n`);
  for (const d of p.docs) h.update(`D ${d.path}\n${d.content}\n`);
  for (const t of p.tests) h.update(`T ${t.path}\n${t.content}\n`);
  return h.digest("hex");
}

export async function buildContextPack(peon: ResolvedPeon, changed: ChangedFile[], root: string, tokensPerPeon: number): Promise<ContextPack> {
  const allow = picomatch(peon.manifest.permissions.read, { dot: true });
  for (const f of changed) assertPermitted(peon, root, f.path, allow);
  const files: PackChangedFile[] = changed.map((f) => ({ ...f, hunksOnly: false }));
  const read = async (paths: string[]): Promise<PackFile[]> => Promise.all(paths.map(async (path) => { assertPermitted(peon, root, path, allow); return { path, content: await readFile(join(root, path), "utf8") }; }));
  const docs = await read(await globFiles(root, peon.manifest.context.docs, 20));
  const changedDirs = new Set(changed.map((f) => dirname(f.path)));
  const changedBases = new Set(changed.map((f) => basename(f.path).replace(/\.[^.]+$/, "")));
  const testPaths = (await globFiles(root, peon.manifest.context.tests, 1000)).filter((t) =>
    !changed.some((c) => c.path === t) && (changedDirs.has(dirname(t)) || changedBases.has(basename(t).replace(/\.(test|spec)\.[^.]+$/, ""))),
  ).slice(0, 10);
  const tests = await read(testPaths);
  const dropped: DroppedItem[] = [];
  const bySize = <T extends { content: string }>(xs: T[]) => [...xs].sort((a, b) => b.content.length - a.content.length);
  let tokens = packTokens(files, docs, tests, peon.body);
  for (const d of bySize(docs)) { if (tokens <= tokensPerPeon) break; docs.splice(docs.indexOf(d), 1); dropped.push({ peon: peon.name, item: `doc ${d.path}`, reason: "budget" }); tokens = packTokens(files, docs, tests, peon.body); }
  for (const t of bySize(tests)) { if (tokens <= tokensPerPeon) break; tests.splice(tests.indexOf(t), 1); dropped.push({ peon: peon.name, item: `test ${t.path}`, reason: "budget" }); tokens = packTokens(files, docs, tests, peon.body); }
  for (const f of bySize(files)) { if (tokens <= tokensPerPeon) break; f.hunksOnly = true; dropped.push({ peon: peon.name, item: `full content ${f.path}`, reason: "budget" }); tokens = packTokens(files, docs, tests, peon.body); }
  const partial = { peon, files, docs, tests, dropped, tokensEstimate: tokens };
  return { ...partial, hash: hashPack(partial) };
}
