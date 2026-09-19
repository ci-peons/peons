import { test, expect } from "bun:test";
import { parsePeonFile, PeonParseError } from "./peon.ts";

const raw = `---
name: a11y
version: 1.0.0
description: WCAG checks
paths: ["**/*.tsx"]
permissions:
  read: ["**/*.tsx"]
---
Guidance.

## Checks

### img-alt
Every img has alt.
`;
test("parses frontmatter and body", () => {
  const p = parsePeonFile(raw);
  expect(p.manifest.name).toBe("a11y");
  expect(p.checks[0]!.id).toBe("img-alt");
  expect(p.body.startsWith("Guidance.")).toBe(true);
});
test("missing frontmatter throws with issues", () => {
  try { parsePeonFile("no frontmatter"); throw new Error("did not throw"); }
  catch (e) { expect(e).toBeInstanceOf(PeonParseError); expect((e as PeonParseError).issues.length).toBeGreaterThan(0); }
});
test("invalid manifest reports zod path", () => {
  const bad = raw.replace("version: 1.0.0", "version: nope");
  try { parsePeonFile(bad); throw new Error("did not throw"); }
  catch (e) { expect((e as PeonParseError).issues.join()).toContain("version"); }
});
