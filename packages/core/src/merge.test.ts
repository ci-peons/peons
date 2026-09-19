import { test, expect } from "bun:test";
import { mergeFindings } from "./merge.ts";
import type { Finding } from "@peons/schema";

const f = (o: Partial<Finding>): Finding => ({ peon: { name: "p", version: "1", hash: "h" }, check: "c", file: "a.tsx", range: [1, 1], severity: "low", message: "m", evidence: ["e"], fingerprint: "fp", ...o });
test("dedupes overlapping same check same file, keeps higher severity", () => {
  const out = mergeFindings([f({ range: [1, 3], severity: "low" }), f({ range: [2, 5], severity: "high" })]);
  expect(out).toHaveLength(1); expect(out[0]!.severity).toBe("high");
});
test("sorts by severity desc then file then line", () => {
  const out = mergeFindings([f({ file: "b.tsx", severity: "low" }), f({ file: "a.tsx", severity: "critical", range: [9, 9] }), f({ file: "a.tsx", severity: "critical", range: [2, 2] })]);
  expect(out.map((x) => `${x.file}:${x.range[0]}`)).toEqual(["a.tsx:2", "a.tsx:9", "b.tsx:1"]);
});
