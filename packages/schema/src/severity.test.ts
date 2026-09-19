import { test, expect } from "bun:test";
import { SeveritySchema, severityRank, atLeast } from "./severity.ts";

test("ranks in order", () => {
  expect(severityRank("info")).toBeLessThan(severityRank("critical"));
  expect(atLeast("high", "medium")).toBe(true);
  expect(atLeast("low", "medium")).toBe(false);
  expect(atLeast("medium", "medium")).toBe(true);
});
test("rejects unknown", () => { expect(SeveritySchema.safeParse("urgent").success).toBe(false); });
