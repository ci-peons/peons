import { test, expect } from "bun:test";
import { matchTriggers } from "./triggers.ts";
import type { ChangeSet, ChangedFile, ResolvedPeon } from "@peons/core";
const P = (name: string, triggers: string[]) => ({ name, enabled: true, manifest: { description: "d", triggers } } as unknown as ResolvedPeon);
const cf = (path: string, text: string, newStart = 1): ChangedFile => ({ path, status: "modified", content: "", hunks: [{ oldStart: 1, oldLines: 1, newStart, newLines: 1, text }] });
test("matches added lines only, first hit per file, reporting the line in the new file", () => {
  // The hunk starts at new-file line 1. The `-` removal is not in the new file so it does not
  // advance; +el.textContent is line 1 and the first +el.innerHTML is line 2.
  const changes = { files: [cf("a.tsx", "@@ -1 +1 @@\n-el.innerHTML = x\n+el.textContent = x\n+el.innerHTML = raw\n+el.innerHTML = raw2")] } as ChangeSet;
  const hits = matchTriggers([P("sec", ["innerHTML"]), P("react", ["useEffect"])], changes);
  expect(hits).toEqual([{ peon: "sec", pattern: "innerHTML", file: "a.tsx", line: 2 }]);
});
test("the reported line is offset by the hunk's newStart and counts context lines", () => {
  const changes = { files: [cf("a.tsx", "@@ -40,3 +42,4 @@\n const a = 1\n-el.innerHTML = x\n const b = 2\n+el.innerHTML = raw", 42)] } as ChangeSet;
  // 42: " const a = 1", removal skipped, 43: " const b = 2", 44: the added innerHTML line.
  expect(matchTriggers([P("sec", ["innerHTML"])], changes)).toEqual([{ peon: "sec", pattern: "innerHTML", file: "a.tsx", line: 44 }]);
});
test("ignores disabled peons and skips the +++ header", () => {
  const changes = { files: [cf("a.tsx", "+++ b/a.tsx\n@@ -0,0 +1 @@\n+ok")] } as ChangeSet;
  expect(matchTriggers([{ ...P("x", ["b/a"]), enabled: false } as ResolvedPeon, P("y", ["\\+\\+\\+"])], changes)).toEqual([]);
});
