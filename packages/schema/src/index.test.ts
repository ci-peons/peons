import { test, expect } from "bun:test";
import { SCHEMA_VERSION } from "./index.ts";
test("schema package loads", () => { expect(SCHEMA_VERSION).toBe(1); });
