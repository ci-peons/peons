import type { ResolvedConfig } from "@peons/core";
import type { DecisionProvider, DecisionQuestion, DecisionResult } from "./types.ts";
import { JevDecisionProvider } from "./jev.ts";
import { LlmDecisionProvider } from "./llm.ts";

export class FallbackProvider implements DecisionProvider {
  kind: DecisionProvider["kind"];
  constructor(
    private primary: DecisionProvider,
    private secondary: DecisionProvider,
  ) {
    this.kind = primary.kind;
  }
  async decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<DecisionResult> {
    try {
      this.kind = this.primary.kind;
      return await this.primary.decide(state, questions);
    } catch {
      this.kind = this.secondary.kind;
      return await this.secondary.decide(state, questions);
    }
  }
}
export function selectDecisionProvider(config: ResolvedConfig, env: NodeJS.ProcessEnv = process.env): DecisionProvider | null {
  const hasJev = !!env.TYPESAFE_API_KEY;
  const hasLlm = !!(env.PEONS_API_KEY || env.ANTHROPIC_API_KEY);
  const jev = () => new JevDecisionProvider({ apiKey: env.TYPESAFE_API_KEY, model: config.boss.model });
  const llm = () => new LlmDecisionProvider({ model: config.models.fast, apiKey: env.PEONS_API_KEY || env.ANTHROPIC_API_KEY });
  if (config.boss.provider === "jev") return hasJev ? jev() : null;
  if (config.boss.provider === "llm") return hasLlm ? llm() : null;
  if (hasJev && hasLlm) return new FallbackProvider(jev(), llm());
  if (hasJev) return jev();
  if (hasLlm) return llm();
  return null;
}
