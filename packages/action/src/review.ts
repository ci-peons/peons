import { MARKER_RE } from "@peons/core";
// Lives here (not index.ts) so it can be imported without running main() at import time: index.ts
// is the action's entry point and calls main() unconditionally at module scope for the CJS bundle.
export function prIntent(pr?: { title?: string; body?: string | null }): string | undefined {
  if (!pr) return undefined;
  const text = [pr.title, pr.body].filter((s): s is string => !!s).join("\n\n").trim();
  return text || undefined;
}
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
