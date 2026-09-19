import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testPeons } from "./test.ts";
import { FakeProvider } from "./provider/fake.ts";
import { EngineError } from "./errors.ts";

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), "t-"));
  const d = join(root, "peons/a11y");
  mkdirSync(join(d, "fixtures/should-flag"), { recursive: true }); mkdirSync(join(d, "fixtures/should-pass"), { recursive: true });
  writeFileSync(join(d, "peon.md"), `---\nname: a11y\nversion: 1.0.0\ndescription: d\npaths: ["**/*.tsx"]\npermissions:\n  read: ["src/**"]\n---\n## Checks\n### img-alt\nx\n### interactive-name\ny\n`);
  writeFileSync(join(d, "fixtures/should-flag/no-alt.tsx"), "<img src=x />\n");
  writeFileSync(join(d, "fixtures/should-flag/no-alt.expect.yaml"), "checks: [img-alt]\n");
  writeFileSync(join(d, "fixtures/should-flag/no-name.tsx"), "<button><Icon/></button>\n");
  writeFileSync(join(d, "fixtures/should-flag/no-name.expect.yaml"), "checks: [interactive-name]\n");
  writeFileSync(join(d, "fixtures/should-pass/ok.tsx"), "<img src=x alt='a' />\n");
  writeFileSync(join(root, "peons.yaml"), "peons:\n  - use: ./peons/a11y\n");
  return root;
}
// Fake model: flags img-alt on any file containing "<img" without "alt", never flags interactive-name.
const fake = new FakeProvider((i) => {
  const m = /<file path="([^"]+)"[^>]*>\n+1: (.*)\n/.exec(i.user)!;
  const [, file, line] = m;
  return { findings: line!.includes("<img") && !line!.includes("alt") ? [{ check: "img-alt", file, range: [1, 1], message: "no alt", evidence: [line] }] : [] };
});
test("scores recall and precision per check", async () => {
  const r = await testPeons({ root: repo(), provider: fake });
  const img = r.checks.find((c) => c.check === "img-alt")!; const nm = r.checks.find((c) => c.check === "interactive-name")!;
  expect(img).toMatchObject({ expected: 1, fired: 1, truePositives: 1, recall: 1, precision: 1 });
  expect(nm).toMatchObject({ expected: 1, fired: 0, truePositives: 0, recall: 0, precision: null });
  expect(r.recall).toBe(0.5); expect(r.precision).toBe(1);
  expect(r.passed).toBe(false); expect(r.failures[0]).toMatch(/recall/);
});
test("thresholds can be lowered", async () => {
  const r = await testPeons({ root: repo(), provider: fake, minRecall: 0.5 });
  expect(r.passed).toBe(true);
});
test("unknown peon name rejects", async () => {
  try {
    await testPeons({ root: repo(), provider: fake, names: ["nope"] });
    throw new Error("expected rejection");
  } catch (e) {
    expect(e).toBeInstanceOf(EngineError);
    expect((e as Error).message).toContain("nope");
  }
});
