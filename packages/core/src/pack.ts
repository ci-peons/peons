import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const ALLOWED = (p: string) => p === "peon.md" || p.startsWith("fixtures/should-flag/") || p.startsWith("fixtures/should-pass/");

async function walk(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) out.push(...(await walk(full, root)));
    else out.push(relative(root, full).split(sep).join("/"));
  }
  return out;
}

function octal(n: number, len: number): Buffer {
  return Buffer.from(n.toString(8).padStart(len - 1, "0") + "\0", "ascii");
}

function header(name: string, size: number): Buffer {
  const h = Buffer.alloc(512, 0);
  h.write(name, 0, 100, "utf8");
  octal(0o644, 8).copy(h, 100);
  octal(0, 8).copy(h, 108);
  octal(0, 8).copy(h, 116);
  octal(size, 12).copy(h, 124);
  octal(0, 12).copy(h, 136);
  Buffer.from("        ", "ascii").copy(h, 148);       // checksum placeholder
  h.write("0", 156, 1, "ascii");                          // regular file
  h.write("ustar\0", 257, 6, "ascii");
  h.write("00", 263, 2, "ascii");
  let sum = 0; for (const b of h) sum += b;
  Buffer.from(sum.toString(8).padStart(6, "0") + "\0 ", "ascii").copy(h, 148);
  return h;
}

/** Deterministic tar.gz: sorted entries, zero mtime/uid/gid, mode 0644, only peon.md and fixtures. */
export async function packDir(dir: string): Promise<Buffer> {
  const files = (await walk(dir)).filter(ALLOWED).sort();
  const parts: Buffer[] = [];
  for (const rel of files) {
    const data = await readFile(join(dir, rel));
    parts.push(header(rel, data.length), data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) parts.push(Buffer.alloc(pad, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(parts), { level: 9 });
}

export function listTar(tgz: Buffer): string[] {
  const tar = gunzipSync(tgz); const names: string[] = []; let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.subarray(off, off + 100).toString("utf8").replace(/\0.*$/, "");
    if (!name) break;
    const size = parseInt(tar.subarray(off + 124, off + 136).toString("ascii"), 8);
    names.push(name); off += 512 + Math.ceil(size / 512) * 512;
  }
  return names;
}

export function sha256Integrity(buf: Buffer): string {
  return "sha256-" + createHash("sha256").update(buf).digest("base64");
}
export async function hashPeonDir(dir: string): Promise<string> { return sha256Integrity(await packDir(dir)); }
export async function isDir(p: string): Promise<boolean> { try { return (await stat(p)).isDirectory(); } catch { return false; } }
