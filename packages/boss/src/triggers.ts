import type { ChangeSet, ResolvedPeon } from "@peons/core";
import type { TriggerHit } from "./state.ts";

export function matchTriggers(peons: ResolvedPeon[], changes: ChangeSet): TriggerHit[] {
  const hits: TriggerHit[] = [];
  for (const peon of peons) {
    if (!peon.enabled || peon.manifest.triggers.length === 0) continue;
    const regexes = peon.manifest.triggers.map((p) => ({ p, re: new RegExp(p) }));
    for (const f of changes.files) {
      let line = 0; let hit: TriggerHit | null = null;
      outer: for (const h of f.hunks) for (const raw of h.text.split("\n")) {
        if (raw.startsWith("@@")) continue;
        line++;
        if (!raw.startsWith("+") || raw.startsWith("+++")) continue;
        for (const { p, re } of regexes) if (re.test(raw.slice(1))) { hit = { peon: peon.name, pattern: p, file: f.path, line }; break outer; }
      }
      if (hit) hits.push(hit);
    }
  }
  return hits;
}
