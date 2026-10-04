import type { ChangeSet, ResolvedPeon } from "@peons/core";
import type { TriggerHit } from "./state.ts";

export function matchTriggers(peons: ResolvedPeon[], changes: ChangeSet): TriggerHit[] {
  const hits: TriggerHit[] = [];
  for (const peon of peons) {
    if (!peon.enabled || peon.manifest.triggers.length === 0) continue;
    const regexes = peon.manifest.triggers.map((p) => ({ p, re: new RegExp(p) }));
    for (const f of changes.files) {
      let hit: TriggerHit | null = null;
      // The reported line is a line in the new file, so each hunk starts at its newStart and only
      // added and context lines advance it: a `-` removal is not in the new file, and the `@@`
      // hunk header and `+++`/`---` file headers are not content at all.
      outer: for (const h of f.hunks) {
        let line = h.newStart;
        for (const raw of h.text.split("\n")) {
          if (raw.startsWith("@@") || raw.startsWith("+++") || raw.startsWith("---")) continue;
          if (raw.startsWith("-")) continue;
          if (raw.startsWith("+")) {
            for (const { p, re } of regexes) if (re.test(raw.slice(1))) { hit = { peon: peon.name, pattern: p, file: f.path, line }; break outer; }
          }
          line++;
        }
      }
      if (hit) hits.push(hit);
    }
  }
  return hits;
}
