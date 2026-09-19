import { test, expect } from "bun:test";
import { isCoveredBy } from "./glob.ts";

test("verbatim match", () => { expect(isCoveredBy("docs/**", ["docs/**"])).toBe(true); });
test("prefix under a ** permission", () => {
  expect(isCoveredBy("docs/a11y/**/*.md", ["docs/**"])).toBe(true);
  expect(isCoveredBy("apps/web/**/*.test.tsx", ["**/*.{tsx,jsx}"])).toBe(false); // extension mismatch is undecidable -> false
  expect(isCoveredBy("apps/web/**/*.test.tsx", ["**"])).toBe(true);
});
test("not covered", () => { expect(isCoveredBy("src/**", ["docs/**"])).toBe(false); });
