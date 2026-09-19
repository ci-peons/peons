import { test, expect } from "bun:test";
import { resolveApiKey } from "./anthropic.ts";
import { EngineError } from "../errors.ts";

test("PEONS_API_KEY wins over ANTHROPIC_API_KEY", () => {
  expect(resolveApiKey({ PEONS_API_KEY: "a", ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)).toBe("a");
  expect(resolveApiKey({ ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)).toBe("b");
});
test("missing key is an EngineError", () => { expect(() => resolveApiKey({} as NodeJS.ProcessEnv)).toThrow(EngineError); });
test.skipIf(!process.env.PEONS_API_KEY && !process.env.ANTHROPIC_API_KEY)("live smoke: returns findings shape", async () => {
  const { AnthropicProvider } = await import("./anthropic.ts");
  const { RawFindingsSchema } = await import("@peons/schema");
  const { findingsToolSchema } = await import("./prompt.ts");
  const out = await new AnthropicProvider().review({
    model: "claude-haiku-4-5-20251001", toolName: "report_findings", toolDescription: "Report findings", schema: findingsToolSchema(),
    system: [{ text: "You review code. Valid check ids: img-alt. Report every <img> without alt via the tool.", cache: false }],
    user: '<file path="a.tsx" status="added">\n1: <img src="x.png" />\n</file>',
  });
  expect(RawFindingsSchema.safeParse(out.raw).success).toBe(true);
  expect(out.usage.inputTokens).toBeGreaterThan(0);
}, 60000);
