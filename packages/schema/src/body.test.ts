import { test, expect } from "bun:test";
import { parsePeonBody, PeonParseError } from "./body.ts";

const md = `Intro guidance.

More guidance.

## Checks

### img-alt
Every img has alt.
Second line.

### interactive-name
Buttons have names.
`;
test("splits guidance and checks", () => {
  const r = parsePeonBody(md);
  expect(r.guidance).toBe("Intro guidance.\n\nMore guidance.");
  expect(r.checks.map((c) => c.id)).toEqual(["img-alt", "interactive-name"]);
  expect(r.checks[0]!.description).toBe("Every img has alt.\nSecond line.");
});
test("requires at least one check", () => { expect(() => parsePeonBody("just prose")).toThrow(PeonParseError); });
test("rejects bad or duplicate ids", () => {
  expect(() => parsePeonBody("## Checks\n### Bad_Id\nx")).toThrow(PeonParseError);
  expect(() => parsePeonBody("## Checks\n### a\nx\n### a\ny")).toThrow(PeonParseError);
});
