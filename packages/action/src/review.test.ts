import { test, expect } from "bun:test";
import { diffLinesFromPatch, existingFingerprints } from "./review.ts";

test("collects right-side line numbers from PR patches", () => {
  const m = diffLinesFromPatch([{ filename: "a.tsx", patch: "@@ -1,2 +1,3 @@\n one\n+two\n three" }, { filename: "bin.png" }]);
  expect([...m.get("a.tsx")!].sort()).toEqual([1, 2, 3]);
  expect(m.has("bin.png")).toBe(false);
});
test("extracts fingerprints from comment markers", () => {
  const fp = "a".repeat(64);
  expect(existingFingerprints([{ body: `hello <!-- peons:fp:${fp} -->` }, { body: "none" }])).toEqual(new Set([fp]));
});
test("extracts fingerprints from review comments and review bodies together", () => {
  const commentFp = "b".repeat(64);
  const reviewFp = "c".repeat(64);
  const comment = { body: `nit <!-- peons:fp:${commentFp} -->` };
  const review = { body: `Outside the diff:\n- foo <!-- peons:fp:${reviewFp} -->` };
  expect(existingFingerprints([comment, review])).toEqual(new Set([commentFp, reviewFp]));
});
