import { test, expect } from "bun:test";
import { LlmDecisionProvider, entropyConfidence } from "./llm.ts";
test("entropy confidence: 1 when concentrated, 0 when uniform", () => {
  expect(entropyConfidence({ "0": 1 })).toBe(1);
  expect(entropyConfidence({ "0": 0.5, "1": 0.5 })).toBeCloseTo(0, 5);
  expect(entropyConfidence({ "0": 0.9, "1": 0.1 })).toBeGreaterThan(0.5);
});
test("forces report_answers tool, maps answers, computes confidence", async () => {
  let seen: unknown;
  const client = { messages: { create: async (body: unknown) => { seen = body; return { content: [{ type: "tool_use", id: "t", name: "report_answers", input: { answers: { "peon:a11y": { type: "noul", noul: 0.8 }, risk: { type: "score", score: 1.2, probabilities: { "1": 0.8, "2": 0.2 } } } } }], usage: { input_tokens: 50, output_tokens: 20 } }; } } };
  const p = new LlmDecisionProvider({ model: "claude-haiku-4-5-20251001", client: client as never });
  const res = await p.decide({ files: [] }, { "peon:a11y": { type: "noul", instructions: "q" }, risk: { type: "score", instructions: "r", criteria: ["a", "b", "c"] } });
  const b = seen as { model: string; tool_choice: { name: string }; tools: Array<{ name: string }>; messages: Array<{ content: string }> };
  expect(b.model).toBe("claude-haiku-4-5-20251001"); expect(b.tool_choice.name).toBe("report_answers"); expect(b.messages[0]!.content).toContain('"files"');
  expect(res.answers["peon:a11y"]).toEqual({ type: "noul", noul: 0.8 });
  const risk = res.answers.risk!; expect(risk.type).toBe("score"); if (risk.type === "score") { expect(risk.confidence).toBeCloseTo(entropyConfidence({ "1": 0.8, "2": 0.2 }), 5); }
  expect(res.usage.inputTokens).toBe(50);
});

// Live: the only check that the forced-tool schema this provider sends is one the real API
// accepts. Skipped without a key, so CI and clones without one are unaffected.
test.skipIf(!process.env.PEONS_API_KEY && !process.env.ANTHROPIC_API_KEY)("live smoke: forced tool schema accepted", async () => {
  const p = new LlmDecisionProvider({ model: "claude-haiku-4-5-20251001" });
  const res = await p.decide(
    { files: [{ path: "apps/web/components/Hero.tsx", status: "modified", added: 3, removed: 1 }], intent: "Add alt text to the hero image" },
    {
      "peon:a11y": { type: "noul", instructions: "Does this change need an accessibility review?", criteria: { true: "it touches markup or ARIA", false: "it does not" } },
      risk: { type: "score", instructions: "How risky is this change?", criteria: ["low", "high"] },
    },
  );
  expect(res.answers["peon:a11y"]!.type).toBe("noul");
  expect(res.answers.risk!.type).toBe("score");
}, 30_000);
