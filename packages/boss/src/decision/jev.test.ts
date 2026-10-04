import { test, expect } from "bun:test";
import { JevDecisionProvider, resolveJevKey } from "./jev.ts";
import { DecisionError } from "./types.ts";

function fakeFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init! }); return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }) as typeof fetch;
  return { f, calls };
}
test("sends state, model and questions with bearer auth; maps answers and usage", async () => {
  const { f, calls } = fakeFetch({ model: "jev-1.13.0", answers: { "peon:a11y": { type: "noul", noul: 0.91 }, risk: { type: "score", score: 1.4, confidence: 0.6, probabilities: { "1": 0.6, "2": 0.4 }, legend: { "1": "x", "2": "y" } } }, usage: { input_tokens: 120, output_tokens: 0 } });
  const p = new JevDecisionProvider({ apiKey: "k", model: "jev-latest", fetch: f });
  const res = await p.decide({ files: [] }, { "peon:a11y": { type: "noul", instructions: "q" }, risk: { type: "score", instructions: "r", criteria: ["a", "b"] } });
  expect(calls[0]!.url).toContain("/v1/systemone");
  expect((calls[0]!.init.headers as Record<string, string>)["authorization"] ?? (calls[0]!.init.headers as Record<string, string>)["Authorization"]).toBe("Bearer k");
  const body = JSON.parse(calls[0]!.init.body as string);
  expect(body.model).toBe("jev-latest"); expect(body.state).toEqual({ files: [] }); expect(body.questions["peon:a11y"]).toMatchObject({ type: "noul", instructions: "q" });
  expect(res).toEqual({ answers: { "peon:a11y": { type: "noul", noul: 0.91 }, risk: { type: "score", score: 1.4, confidence: 0.6, probabilities: { "1": 0.6, "2": 0.4 } } }, model: "jev-1.13.0", usage: { inputTokens: 120 } });
});
test("malformed answer is a DecisionError", async () => {
  const { f } = fakeFetch({ model: "m", answers: { "peon:a11y": { type: "noul" } }, usage: { input_tokens: 1 } });
  await expect(new JevDecisionProvider({ apiKey: "k", fetch: f }).decide({}, { "peon:a11y": { type: "noul", instructions: "q" } })).rejects.toBeInstanceOf(DecisionError);
});
test("missing key", () => { expect(() => resolveJevKey({} as NodeJS.ProcessEnv)).toThrow(DecisionError); });
test.skipIf(!process.env.TYPESAFE_API_KEY)("live smoke", async () => {
  const res = await new JevDecisionProvider({}).decide({ files: [{ path: "a.tsx", status: "added", added: 3, removed: 0 }], reviewers: [{ name: "a11y", description: "WCAG checks" }], triggers_hit: [] }, { "peon:a11y": { type: "noul", instructions: "Would the a11y reviewer find issues?" } });
  expect(res.answers["peon:a11y"]!.type).toBe("noul");
}, 30000);
