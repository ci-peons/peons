import { test, expect } from "bun:test";
import { EngineError } from "./errors.ts";

test("carries an optional status and exit stays 2", () => {
  const e = new EngineError("X", "m", { status: 429 });
  expect(e.status).toBe(429);
  expect(e.exit).toBe(2);
});
test("carries an optional cause", () => {
  const cause = new Error("root");
  const e = new EngineError("X", "m", { cause });
  expect(e.cause).toBe(cause);
});
test("status is undefined when not given", () => {
  const e = new EngineError("X", "m");
  expect(e.status).toBeUndefined();
});
