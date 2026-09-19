import { test, expect } from "bun:test";
import { renderSystem, renderUser, findingsToolSchema, buildReviewInput } from "./prompt.ts";
import type { ContextPack } from "../context.ts";

const pack = {
  peon: { name: "a11y", version: "1.0.0", hash: "h", body: "Guidance\n\n## Checks\n\n### img-alt\nAlt.", guidance: "Guidance", checks: [{ id: "img-alt", title: "img-alt", description: "Alt." }], manifest: { severity: { default: "medium" } } },
  files: [{ path: "a.tsx", status: "added", content: "<img src=x />\n", hunks: [{ text: "@@ -0,0 +1 @@\n+<img src=x />" }], hunksOnly: false }],
  docs: [{ path: "docs/r.md", content: "# r" }], tests: [], dropped: [], tokensEstimate: 10, hash: "p",
} as unknown as ContextPack;

test("system has preamble then cached peon body", () => {
  const s = renderSystem(pack.peon);
  expect(s).toHaveLength(2);
  expect(s[0]!.cache).toBe(false); expect(s[0]!.text).toContain("report_findings");
  expect(s[1]!.cache).toBe(true); expect(s[1]!.text).toContain("### img-alt");
});
test("user message tags files, hunks and docs", () => {
  const u = renderUser(pack);
  expect(u).toContain('<file path="a.tsx" status="added">');
  expect(u).toContain("<hunks>"); expect(u).toContain('<doc path="docs/r.md">');
  expect(u).toContain("Valid check ids: img-alt");
});
test("tool schema is JSON schema with findings array", () => {
  const s = findingsToolSchema() as { properties: { findings: { type: string } } };
  expect(s.properties.findings.type).toBe("array");
});
test("buildReviewInput wires model and tool", () => {
  const i = buildReviewInput(pack, "claude-haiku-4-5-20251001");
  expect(i.model).toBe("claude-haiku-4-5-20251001"); expect(i.toolName).toBe("report_findings");
});
