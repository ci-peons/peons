export type DecisionQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "score"; instructions: string; criteria: string[] };
export type DecisionAnswer =
  | { type: "noul"; noul: number }
  | { type: "score"; score: number; confidence: number; probabilities: Record<string, number> };
export type DecisionResult = { answers: Record<string, DecisionAnswer>; model: string; usage: { inputTokens: number } };
export interface DecisionProvider {
  readonly kind: "jev" | "llm" | "fake";
  decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<DecisionResult>;
}
export class DecisionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "DecisionError";
  }
}
