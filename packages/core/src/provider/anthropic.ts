import Anthropic from "@anthropic-ai/sdk";
import { EngineError } from "../errors.ts";
import type { Provider, ReviewInput, ReviewOutput } from "./types.ts";

export function resolveApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const k = env.PEONS_API_KEY || env.ANTHROPIC_API_KEY;
  if (!k) throw new EngineError("NO_API_KEY", "no API key: set PEONS_API_KEY or ANTHROPIC_API_KEY");
  return k;
}
export class AnthropicProvider implements Provider {
  private client: Anthropic;
  constructor(opts: { apiKey?: string; maxRetries?: number } = {}) {
    this.client = new Anthropic({ apiKey: opts.apiKey ?? resolveApiKey(), maxRetries: opts.maxRetries ?? 3 });
  }
  async review(input: ReviewInput): Promise<ReviewOutput> {
    let res: Anthropic.Message;
    try {
      res = await this.client.messages.create({
        model: input.model, max_tokens: 4096, temperature: 0,
        system: input.system.map((b) => ({ type: "text" as const, text: b.text, ...(b.cache ? { cache_control: { type: "ephemeral" as const } } : {}) })),
        tools: [{ name: input.toolName, description: input.toolDescription, input_schema: input.schema as Anthropic.Tool.InputSchema }],
        tool_choice: { type: "tool", name: input.toolName },
        messages: [{ role: "user", content: input.user }],
      });
    } catch (e) {
      const err = e as { status?: number; message: string };
      throw new EngineError("PROVIDER", `Anthropic request failed${err.status ? ` (${err.status})` : ""}: ${err.message}`);
    }
    const tool = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (!tool) throw new EngineError("PROVIDER", "model did not call report_findings");
    return {
      raw: tool.input,
      usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens, cacheReadTokens: res.usage.cache_read_input_tokens ?? 0 },
    };
  }
}
