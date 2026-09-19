import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { git, gitHeadSha, defaultBase } from "./git.ts";
import { parseUnifiedDiff, type Hunk } from "./diff.ts";

export type ScopeSpec = { kind: "staged" } | { kind: "branch"; base?: string } | { kind: "files"; paths: string[] };
export type ChangedFile = { path: string; status: "added" | "modified" | "renamed"; content: string; hunks: Hunk[] };
export type ChangeSet = { scope: ScopeSpec; base?: string; sha: string; files: ChangedFile[]; warnings: string[] };
export const MAX_FILE_BYTES = 200 * 1024;

function isBinary(buf: Buffer): boolean { return buf.subarray(0, 8000).includes(0); }
function statusOf(code: string): ChangedFile["status"] | null {
  if (code.startsWith("A")) return "added"; if (code.startsWith("M")) return "modified"; if (code.startsWith("R")) return "renamed"; return null;
}

async function fromGit(root: string, scope: ScopeSpec, diffArgs: string[], showRef: string): Promise<Omit<ChangeSet, "scope" | "base">> {
  const warnings: string[] = [];
  const nameStatus = await git(root, ["diff", "--name-status", "-M", ...diffArgs]);
  const hunks = parseUnifiedDiff(await git(root, ["diff", "--unified=3", "--no-color", "--no-ext-diff", "-M", ...diffArgs]));
  const files: ChangedFile[] = [];
  for (const line of nameStatus.split("\n").filter(Boolean)) {
    const [code, ...rest] = line.split("\t"); const path = rest[rest.length - 1]!;
    const status = statusOf(code!); if (!status) continue;
    const bytes = Buffer.from(await git(root, ["show", `${showRef}${path}`]), "utf8");
    if (isBinary(bytes)) { warnings.push(`${path}: binary, skipped`); continue; }
    if (bytes.length > MAX_FILE_BYTES) { warnings.push(`${path}: over 200 KB, skipped`); continue; }
    files.push({ path, status, content: bytes.toString("utf8"), hunks: hunks.get(path) ?? [] });
  }
  return { sha: await gitHeadSha(root), files, warnings };
}

export async function computeChangeSet(root: string, scope: ScopeSpec): Promise<ChangeSet> {
  if (scope.kind === "staged") {
    return { scope, ...(await fromGit(root, scope, ["--cached"], ":")) };
  }
  if (scope.kind === "branch") {
    const base = scope.base ?? (await defaultBase(root));
    const mb = (await git(root, ["merge-base", base, "HEAD"])).trim();
    return { scope, base, ...(await fromGit(root, scope, [mb, "HEAD"], "HEAD:")) };
  }
  const warnings: string[] = []; const files: ChangedFile[] = [];
  for (const path of scope.paths) {
    const abs = resolve(root, path);
    if (abs !== root && !abs.startsWith(root + sep)) { warnings.push(`${path}: outside the repository, skipped`); continue; }
    let buf: Buffer;
    try { buf = await readFile(join(root, path)); } catch { warnings.push(`${path}: not found, skipped`); continue; }
    if (isBinary(buf)) { warnings.push(`${path}: binary, skipped`); continue; }
    if (buf.length > MAX_FILE_BYTES) { warnings.push(`${path}: over 200 KB, skipped`); continue; }
    const content = buf.toString("utf8");
    const lines = content.split("\n"); if (lines[lines.length - 1] === "") lines.pop();
    const text = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => "+" + l)].join("\n");
    files.push({ path, status: "added", content, hunks: [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, text }] });
  }
  return { scope, sha: await gitHeadSha(root), files, warnings };
}
