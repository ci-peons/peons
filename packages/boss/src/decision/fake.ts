import type { DecisionAnswer, DecisionProvider, DecisionQuestion, DecisionResult } from "./types.ts";

export class FakeDecisionProvider implements DecisionProvider {
  readonly kind = "fake" as const;
  calls: Array<{ state: unknown; questions: Record<string, DecisionQuestion> }> = [];
  constructor(
    private script: (q: Record<string, DecisionQuestion>, state: unknown) => Record<string, DecisionAnswer> | Error = (q) =>
      Object.fromEntries(
        Object.entries(q).map(([k, v]) => [
          k,
          v.type === "noul" ? { type: "noul", noul: 0.5 } : { type: "score", score: 1, confidence: 1, probabilities: { "1": 1 } },
        ]),
      ) as Record<string, DecisionAnswer>,
  ) {}
  async decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<DecisionResult> {
    this.calls.push({ state, questions });
    const out = this.script(questions, state);
    if (out instanceof Error) throw out;
    return { answers: out, model: "fake", usage: { inputTokens: JSON.stringify(state).length / 4 } };
  }
}
