import { test, expect } from "bun:test";
import { diffLinesFromPatch, existingFingerprints, prIntent } from "./review.ts";

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
test("prIntent joins title and body, undefined when empty", () => {
  expect(prIntent({ title: "Fix", body: "Details" })).toBe("Fix\n\nDetails");
  expect(prIntent({ title: "Fix", body: null })).toBe("Fix");
  expect(prIntent(undefined)).toBeUndefined();
});
// prIntent is a pure join with no redaction or truncation of its own: index.ts is responsible for
// routing its result through @peons/boss's resolveIntent(root, prIntent(pr)) before handing it to
// the Boss, which is what applies redactText and the 500-char cap (spec §11). This test documents
// that contract at the pure-function level; the wiring in index.ts is verified separately since
// index.ts has no test seam (see the fix report for the grep confirming the call site).
test("prIntent itself does not redact secrets; that is resolveIntent's job in index.ts", () => {
  expect(prIntent({ title: "Fix", body: 'token = "q8Zk2mN7pL4vX9wR3tY6uB1cD5fG0hJa"' })).toBe('Fix\n\ntoken = "q8Zk2mN7pL4vX9wR3tY6uB1cD5fG0hJa"');
});
