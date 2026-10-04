import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FakeProvider } from "@peons/core";
import { FakeDecisionProvider, type DecisionProvider } from "@peons/boss";
import { runCli } from "../../cli/src/index.ts";
import { createServer } from "./server.ts";

function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "mcp-"));
  mkdirSync(join(cwd, "peons/p"), { recursive: true });
  writeFileSync(join(cwd, "peons/p/peon.md"), `---\nname: p\nversion: 1.0.0\ndescription: d\npaths: ["**/*.tsx"]\npermissions:\n  read: ["**"]\n---\n## Checks\n### c\nx\n`);
  // "q" never matches a.tsx by path, so it stays unplanned under PathPlanner and the Boss must
  // consult the decision provider to resolve it (needed for the auto/intent test below, without
  // affecting the two path-only tests, which never see "q" dispatched).
  mkdirSync(join(cwd, "peons/q"), { recursive: true });
  writeFileSync(join(cwd, "peons/q/peon.md"), `---\nname: q\nversion: 1.0.0\ndescription: d\npaths: ["db/**"]\npermissions:\n  read: ["**"]\n---\n## Checks\n### c\nx\n`);
  writeFileSync(join(cwd, "peons.yaml"), "peons:\n  - use: ./peons/p\n  - use: ./peons/q\n");
  writeFileSync(join(cwd, "a.tsx"), "bad\n");
  return cwd;
}
const script = (i: { user: string }) => { const m = /<file path="([^"]+)"/.exec(i.user)!; return { findings: [{ check: "c", file: m[1], range: [1, 1], severity: "high", message: "bad", evidence: ["bad"] }] }; };

async function client(root: string, opts: { decision?: DecisionProvider | null } = {}) {
  const server = createServer({ root, provider: new FakeProvider(script), decision: opts.decision });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const c = new Client({ name: "t", version: "0" }); await c.connect(b);
  return c;
}
test("lists tools and peons", async () => {
  const c = await client(repo());
  expect((await c.listTools()).tools.map((t) => t.name).sort()).toEqual(["list_peons", "plan", "run_peons"]);
  const r = await c.callTool({ name: "list_peons", arguments: {} }) as { content: Array<{ text: string }> };
  expect(JSON.parse(r.content[0]!.text)[0].name).toBe("p@1.0.0");
});
test("surface parity: MCP run_peons findings equal the CLI json output byte for byte", async () => {
  const root = repo();
  // The CLI goes first with --no-cache so it is the uncached path; MCP may then serve from cache.
  let stdout = ""; let stderr = "";
  const exit = await runCli(
    ["run", "--scope", "files", "a.tsx", "--format", "json", "--no-cache"],
    { cwd: root, stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; } },
    { provider: new FakeProvider(script), tty: false },
  );
  expect(exit).toBe(1);
  const viaCli = JSON.parse(stdout) as { findings: unknown[] };
  const c = await client(root);
  const viaMcp = await c.callTool({ name: "run_peons", arguments: { scope: "files", files: ["a.tsx"] } }) as { content: Array<{ text: string }> };
  const mcpResult = JSON.parse(viaMcp.content[1]!.text) as { findings: unknown[] };
  expect(JSON.stringify(mcpResult.findings)).toBe(JSON.stringify(viaCli.findings));
  expect(viaMcp.content[0]!.text).toContain("## [HIGH] a.tsx:1 · p/c");
});
test("plan with auto and intent uses the Boss and reports it", async () => {
  const root = repo(); const c = await client(root, { decision: new FakeDecisionProvider((q) => Object.fromEntries(Object.keys(q).map((k) => [k, k === "risk" ? { type: "score", score: 1, confidence: 1, probabilities: { "1": 1 } } : { type: "noul", noul: 0.9 }]))) });
  const r = await c.callTool({ name: "plan", arguments: { scope: "files", files: ["a.tsx"], auto: true, intent: "x" } }) as { content: Array<{ text: string }> };
  expect(JSON.parse(r.content[0]!.text).boss.provider).toBe("fake");
});
