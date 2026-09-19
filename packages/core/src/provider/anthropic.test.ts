import { test, expect } from "bun:test";
import { resolveApiKey, AnthropicProvider, type MessagesClient } from "./anthropic.ts";
import { EngineError } from "../errors.ts";
import type { ReviewInput } from "./types.ts";

test("PEONS_API_KEY wins over ANTHROPIC_API_KEY", () => {
  expect(resolveApiKey({ PEONS_API_KEY: "a", ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)).toBe("a");
  expect(resolveApiKey({ ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)).toBe("b");
});
test("missing key is an EngineError", () => { expect(() => resolveApiKey({} as NodeJS.ProcessEnv)).toThrow(EngineError); });

const schema = { type: "object", properties: { findings: { type: "array" } }, required: ["findings"] } as Record<string, unknown>;
const input: ReviewInput = {
  model: "claude-haiku-4-5-20251001", toolName: "report_findings", toolDescription: "Report findings", schema,
  system: [{ text: "preamble", cache: false }, { text: "peon body", cache: true }],
  user: '<file path="a.tsx" status="added">\n1: <img src="x.png" />\n</file>',
};
function fakeClient(create: (body: unknown) => Promise<unknown>): { client: MessagesClient; calls: unknown[] } {
  const calls: unknown[] = [];
  const client = { messages: { create: (body: unknown) => { calls.push(body); return create(body); } } } as unknown as MessagesClient;
  return { client, calls };
}
const okResponse = {
  content: [{ type: "tool_use", id: "t", name: "report_findings", input: { findings: [] } }],
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3 },
};

test("review() sends the pinned request shape and maps the tool result", async () => {
  const { client, calls } = fakeClient(async () => okResponse);
  const out = await new AnthropicProvider({ client }).review(input);
  expect(calls).toHaveLength(1);
  const body = calls[0] as Record<string, unknown>;
  expect(body.model).toBe("claude-haiku-4-5-20251001");
  expect(body.max_tokens).toBe(4096);
  expect(Object.keys(body)).not.toContain("temperature");   // Sonnet 5 / Opus 5 reject sampling params
  expect(body.system).toEqual([
    { type: "text", text: "preamble" },
    { type: "text", text: "peon body", cache_control: { type: "ephemeral" } },
  ]);
  const tools = body.tools as Array<Record<string, unknown>>;
  expect(tools).toHaveLength(1);
  expect(tools[0]!.name).toBe("report_findings");
  expect(tools[0]!.description).toBe("Report findings");
  expect(tools[0]!.input_schema).toEqual(schema);
  expect(body.tool_choice).toEqual({ type: "tool", name: "report_findings" });
  expect(body.messages).toEqual([{ role: "user", content: input.user }]);
  expect(out).toEqual({ raw: { findings: [] }, usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 3 } });
});

test("a request failure becomes a PROVIDER EngineError carrying the status", async () => {
  const { client } = fakeClient(async () => { throw Object.assign(new Error("rate"), { status: 429 }); });
  const e = await new AnthropicProvider({ client }).review(input).catch((x) => x as EngineError);
  expect(e).toBeInstanceOf(EngineError);
  expect((e as EngineError).code).toBe("PROVIDER");
  expect((e as EngineError & { status?: number }).status).toBe(429);
  expect((e as EngineError).message).toContain("429");
});

test("a response without a tool_use block is a PROVIDER EngineError", async () => {
  const { client } = fakeClient(async () => ({ content: [{ type: "text", text: "no" }], usage: { input_tokens: 1, output_tokens: 1 } }));
  const e = await new AnthropicProvider({ client }).review(input).catch((x) => x as EngineError);
  expect(e).toBeInstanceOf(EngineError);
  expect((e as EngineError).code).toBe("PROVIDER");
});

test("missing cache_read_input_tokens reads as 0", async () => {
  const { client } = fakeClient(async () => ({ ...okResponse, usage: { input_tokens: 2, output_tokens: 1 } }));
  const out = await new AnthropicProvider({ client }).review(input);
  expect(out.usage.cacheReadTokens).toBe(0);
});

test.skipIf(!process.env.PEONS_API_KEY && !process.env.ANTHROPIC_API_KEY)("live smoke: returns findings shape", async () => {
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
