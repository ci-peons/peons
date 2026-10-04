import { test, expect } from "bun:test";
import { selectDecisionProvider, FallbackProvider } from "./select.ts";
import { FakeDecisionProvider } from "./fake.ts";
import type { ResolvedConfig } from "@peons/core";
const cfg = (provider: "auto" | "jev" | "llm"): ResolvedConfig => ({ models: { fast: "claude-haiku-4-5-20251001" }, boss: { provider, model: "jev-latest" } } as unknown as ResolvedConfig);
test("auto prefers jev when key present, else llm when anthropic key present, else null", () => {
  expect(selectDecisionProvider(cfg("auto"), { TYPESAFE_API_KEY: "a", ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)!.kind).toBe("jev");
  expect(selectDecisionProvider(cfg("auto"), { ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)!.kind).toBe("llm");
  expect(selectDecisionProvider(cfg("auto"), {} as NodeJS.ProcessEnv)).toBeNull();
});
test("explicit provider without its key yields null (planner reports unavailable)", () => {
  expect(selectDecisionProvider(cfg("jev"), {} as NodeJS.ProcessEnv)).toBeNull();
  expect(selectDecisionProvider(cfg("llm"), {} as NodeJS.ProcessEnv)).toBeNull();
});
test("with both keys present, auto selection reports kind jev before any decide call", () => {
  const provider = selectDecisionProvider(cfg("auto"), { TYPESAFE_API_KEY: "a", ANTHROPIC_API_KEY: "b" } as NodeJS.ProcessEnv)!;
  expect(provider.kind).toBe("jev");
});
test("FallbackProvider falls back to the secondary provider when the primary throws", async () => {
  const primary = new FakeDecisionProvider(() => new Error("primary down"));
  const secondary = new FakeDecisionProvider((q) =>
    Object.fromEntries(Object.entries(q).map(([k, v]) => [k, v.type === "noul" ? { type: "noul" as const, noul: 0.5 } : { type: "score" as const, score: 1, confidence: 1, probabilities: { "1": 1 } }])),
  );
  const fallback = new FallbackProvider(primary, secondary);
  const res = await fallback.decide({}, { q: { type: "noul", instructions: "x" } });
  expect(res.answers.q).toEqual({ type: "noul", noul: 0.5 });
  expect(fallback.kind).toBe("fake");
});
