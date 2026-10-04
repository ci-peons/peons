import { test, expect } from "bun:test";
import { matchTriggers } from "./triggers.ts";
import type { ChangeSet, ChangedFile, ResolvedPeon } from "@peons/core";
const P = (name: string, triggers: string[]) => ({ name, enabled: true, manifest: { description: "d", triggers } } as unknown as ResolvedPeon);
const cf = (path: string, text: string): ChangedFile => ({ path, status: "modified", content: "", hunks: [{ oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, text }] });
test("matches added lines only, first hit per file, with 1-based line index within the hunk body", () => {
  const changes = { files: [cf("a.tsx", "@@ -1 +1 @@\n-el.innerHTML = x\n+el.textContent = x\n+el.innerHTML = raw\n+el.innerHTML = raw2")] } as ChangeSet;
  const hits = matchTriggers([P("sec", ["innerHTML"]), P("react", ["useEffect"])], changes);
  expect(hits).toEqual([{ peon: "sec", pattern: "innerHTML", file: "a.tsx", line: 3 }]);
});
test("ignores disabled peons and skips the +++ header", () => {
  const changes = { files: [cf("a.tsx", "+++ b/a.tsx\n@@ -0,0 +1 @@\n+ok")] } as ChangeSet;
  expect(matchTriggers([{ ...P("x", ["b/a"]), enabled: false } as ResolvedPeon, P("y", ["\\+\\+\\+"])], changes)).toEqual([]);
});
