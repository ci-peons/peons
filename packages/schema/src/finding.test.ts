import { test, expect } from "bun:test";
import { RawFindingsSchema, fingerprint } from "./finding.ts";

test("raw findings schema accepts model output and defaults nothing", () => {
  const r = RawFindingsSchema.parse({ findings: [{ check: "img-alt", file: "a.tsx", range: [3, 3], message: "m", evidence: ["<img src=x />"] }] });
  expect(r.findings[0]!.severity).toBeUndefined();
});
test("fingerprint ignores whitespace differences", () => {
  expect(fingerprint("img-alt", ["<img   src=x />"])).toBe(fingerprint("img-alt", ["<img src=x />"]));
  expect(fingerprint("img-alt", ["a"])).not.toBe(fingerprint("interactive-name", ["a"]));
});
