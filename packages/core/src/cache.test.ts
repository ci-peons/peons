import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FindingsCache, cacheKey } from "./cache.ts";

test("miss then hit", async () => {
  const c = new FindingsCache(mkdtempSync(join(tmpdir(), "cache-")));
  const k = cacheKey("peon", "pack", "model");
  expect(await c.get(k)).toBeNull();
  await c.set(k, []);
  expect(await c.get(k)).toEqual([]);
  expect(cacheKey("peon", "pack", "other")).not.toBe(k);
});
