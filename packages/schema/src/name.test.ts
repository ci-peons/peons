import { test, expect } from "bun:test";
import { validatePeonName } from "./name.ts";

test("unscoped ok", () => { expect(validatePeonName("a11y")).toEqual({ ok: true, scope: null, base: "a11y" }); });
test("scoped ok", () => { expect(validatePeonName("@dan/events-domain")).toEqual({ ok: true, scope: "dan", base: "events-domain" }); });
test("rejects uppercase, spaces, leading dot, long", () => {
  expect(validatePeonName("A11y").ok).toBe(false);
  expect(validatePeonName("my peon").ok).toBe(false);
  expect(validatePeonName(".hidden").ok).toBe(false);
  expect(validatePeonName("a".repeat(215)).ok).toBe(false);
  expect(validatePeonName("@dan").ok).toBe(false);
});
