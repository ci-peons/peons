import type { Provider, ReviewInput, ReviewOutput } from "./types.ts";
export class FakeProvider implements Provider {
  calls: ReviewInput[] = [];
  constructor(private script: (input: ReviewInput) => unknown = () => ({ findings: [] })) {}
  async review(input: ReviewInput): Promise<ReviewOutput> {
    this.calls.push(input);
    const raw = this.script(input);
    if (raw instanceof Error) throw raw;
    return { raw, usage: { inputTokens: Math.ceil(input.user.length / 4), outputTokens: 50, cacheReadTokens: 0 } };
  }
}
