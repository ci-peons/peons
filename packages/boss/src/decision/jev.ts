import { TypeSafeClient } from "@typesafe-ai/sdk";
import { z } from "zod";
import { DecisionError, type DecisionAnswer, type DecisionProvider, type DecisionQuestion, type DecisionResult } from "./types.ts";

export function resolveJevKey(env: NodeJS.ProcessEnv = process.env): string {
  const k = env.TYPESAFE_API_KEY;
  if (!k) throw new DecisionError("no TYPESAFE_API_KEY");
  return k;
}
const Answer = z.discriminatedUnion("type", [
  z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }),
  z.object({ type: z.literal("score"), score: z.number(), confidence: z.number().min(0).max(1), probabilities: z.record(z.string(), z.number()) }),
]);
export class JevDecisionProvider implements DecisionProvider {
  readonly kind = "jev" as const;
  private client: TypeSafeClient;
  private model: string;
  constructor(opts: { apiKey?: string; model?: string; fetch?: typeof fetch } = {}) {
    this.model = opts.model ?? "jev-latest";
    this.client = new TypeSafeClient({ apiKey: opts.apiKey ?? resolveJevKey(), ...(opts.fetch ? { fetch: opts.fetch as never } : {}) });
  }
  async decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<DecisionResult> {
    let res: { answers: Record<string, unknown>; model: string; usage?: Record<string, number> };
    try {
      res = (await this.client.systemOne({ state: state as never, model: this.model, questions: questions as never })) as never;
    } catch (e) {
      throw new DecisionError(`Jev request failed: ${(e as Error).message}`, e);
    }
    const answers: Record<string, DecisionAnswer> = {};
    for (const id of Object.keys(questions)) {
      const parsed = Answer.safeParse(res.answers[id]);
      if (!parsed.success) throw new DecisionError(`Jev answer for "${id}" is missing or malformed`);
      answers[id] =
        parsed.data.type === "noul"
          ? { type: "noul", noul: parsed.data.noul }
          : { type: "score", score: parsed.data.score, confidence: parsed.data.confidence, probabilities: parsed.data.probabilities };
    }
    const u = res.usage ?? {};
    return { answers, model: res.model, usage: { inputTokens: u.input_tokens ?? u.inputTokens ?? 0 } };
  }
}
