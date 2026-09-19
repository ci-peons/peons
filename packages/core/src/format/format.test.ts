import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatAgent, formatSarif, formatJson, buildReviewPayload } from "./index.ts";
import type { RunResult } from "@peons/schema";

export const SAMPLE: RunResult = {
  plan: { entries: [{ peon: "a11y", files: [{ path: "src/a.tsx", reason: "matched **/*.tsx" }] }], skipped: [] },
  findings: [
    { peon: { name: "a11y", version: "1.0.0", hash: "sha256-abc" }, check: "img-alt", file: "src/a.tsx", range: [4, 4], severity: "high",
      message: "Image has no alt attribute.", evidence: ['<img src="/logo.png" />'], fix: 'Add alt="Company logo".', fingerprint: "f".repeat(64) },
    { peon: { name: "a11y", version: "1.0.0", hash: "sha256-abc" }, check: "interactive-name", file: "src/a.tsx", range: [10, 12], severity: "medium",
      message: "Icon button has no accessible name.", evidence: ["<button>", "  <Icon />", "</button>"], fingerprint: "e".repeat(64) },
  ],
  peons: [{ name: "a11y", version: "1.0.0", status: "ok", durationMs: 4200, findings: 2, usage: { inputTokens: 1200, outputTokens: 80, cacheReadTokens: 900 } }],
  redactions: 1, dropped: [], exit: 1, durationMs: 4300,
};
const golden = (n: string) => readFileSync(join(import.meta.dir, "__golden__", n), "utf8");

test("agent format matches golden", () => { expect(formatAgent(SAMPLE)).toBe(golden("agent.md")); });
test("sarif matches golden", () => { expect(JSON.parse(formatSarif(SAMPLE))).toEqual(JSON.parse(golden("sarif.json"))); });
test("json round-trips", () => { expect(JSON.parse(formatJson(SAMPLE))).toEqual(SAMPLE); });
test("review payload: inline for diff lines, summary for the rest, skips existing fingerprints", () => {
  const p = buildReviewPayload(SAMPLE, { existingFingerprints: new Set(["e".repeat(64)]), diffLines: new Map([["src/a.tsx", new Set([4])]]) });
  expect(p.event).toBe("REQUEST_CHANGES");
  expect(p.comments).toHaveLength(1);
  expect(p.comments[0]).toMatchObject({ path: "src/a.tsx", line: 4 });
  expect(p.comments[0]!.body).toContain("<!-- peons:fp:ffff");
  expect(p.body).not.toContain("Icon button"); // already posted
});
