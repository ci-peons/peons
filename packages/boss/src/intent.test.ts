import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveIntent } from "./intent.ts";
test("explicit intent wins, is redacted and truncated", async () => {
  const s = await resolveIntent("/nonexistent", "token = \"q8Zk2mN7pL4vX9wR3tY6uB1cD5fG0hJa\" " + "x".repeat(600));
  expect(s).toContain("<REDACTED:high-entropy>"); expect(s!.length).toBe(500);
});
test("falls back to the last commit message; undefined outside git", async () => {
  const root = mkdtempSync(join(tmpdir(), "intent-"));
  const g = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "pipe" });
  g("init", "-q", "-b", "main"); g("config", "user.email", "t@t"); g("config", "user.name", "t");
  writeFileSync(join(root, "a"), "a"); g("add", "."); g("commit", "-qm", "Add idempotency key to bookings");
  expect(await resolveIntent(root)).toBe("Add idempotency key to bookings");
  expect(await resolveIntent(mkdtempSync(join(tmpdir(), "nogit-")))).toBeUndefined();
});
