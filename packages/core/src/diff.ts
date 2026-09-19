export type Hunk = { oldStart: number; oldLines: number; newStart: number; newLines: number; text: string };
const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export function parseUnifiedDiff(diff: string): Map<string, Hunk[]> {
  const out = new Map<string, Hunk[]>();
  let path: string | null = null; let cur: Hunk | null = null; let buf: string[] = [];
  const flush = () => { if (path && cur) { cur.text = buf.join("\n"); out.get(path)!.push(cur); } cur = null; buf = []; };
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) { flush(); path = null; continue; }
    if (line.startsWith("+++ ")) { const p = line.slice(4).trim(); path = p === "/dev/null" ? null : p.replace(/^b\//, ""); if (path && !out.has(path)) out.set(path, []); continue; }
    const m = HUNK.exec(line);
    if (m && path) { flush(); cur = { oldStart: +m[1]!, oldLines: m[2] === undefined ? 1 : +m[2], newStart: +m[3]!, newLines: m[4] === undefined ? 1 : +m[4], text: "" }; buf = [line]; continue; }
    if (cur) buf.push(line);
  }
  flush();
  return out;
}
