import { MARKER_RE } from "@peons/core";
export function diffLinesFromPatch(files: Array<{ filename: string; patch?: string }>): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const f of files) {
    if (!f.patch) continue;
    const lines = new Set<number>(); let n = 0;
    for (const l of f.patch.split("\n")) {
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
      if (h) { n = Number(h[1]); continue; }
      if (l.startsWith("-")) continue;
      lines.add(n); n++;
    }
    out.set(f.filename, lines);
  }
  return out;
}
export function existingFingerprints(comments: Array<{ body: string }>): Set<string> {
  const s = new Set<string>();
  for (const c of comments) for (const m of c.body.matchAll(MARKER_RE)) s.add(m[1]!);
  return s;
}
