import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packDir, hashPeonDir, listTar } from "./pack.ts";

function makePeon(): string {
  const d = mkdtempSync(join(tmpdir(), "peon-"));
  writeFileSync(join(d, "peon.md"), "---\nname: x\n---\n## Checks\n### a\nb\n");
  mkdirSync(join(d, "fixtures/should-pass"), { recursive: true });
  writeFileSync(join(d, "fixtures/should-pass/ok.tsx"), "export const a = 1;\n");
  writeFileSync(join(d, "README.md"), "ignored");
  return d;
}
test("pack is deterministic across mtimes and excludes extra files", async () => {
  const a = makePeon(); const b = makePeon();
  utimesSync(join(b, "peon.md"), new Date(0), new Date(0));
  const pa = await packDir(a); const pb = await packDir(b);
  expect(pa.equals(pb)).toBe(true);
  expect(listTar(pa)).toEqual(["fixtures/should-pass/ok.tsx", "peon.md"]);
  expect(await hashPeonDir(a)).toMatch(/^sha256-[A-Za-z0-9+/=]+$/);
});
