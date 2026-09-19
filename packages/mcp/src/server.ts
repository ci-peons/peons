import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadConfig, computeChangeSet, PathPlanner, run, formatAgent, type Provider, type ScopeSpec } from "@peons/core";
import { SeveritySchema } from "@peons/schema";

const scopeOf = (scope: "staged" | "branch" | "files", base?: string, files?: string[]): ScopeSpec =>
  scope === "files" ? { kind: "files", paths: files ?? [] } : scope === "branch" ? { kind: "branch", base } : { kind: "staged" };
const text = (t: string) => ({ type: "text" as const, text: t });
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createServer(opts: { root: string; provider?: Provider }): McpServer {
  const server = new McpServer({ name: "peons", version: "0.1.0" });
  server.registerTool("list_peons", { description: "List the peons configured in this repository", inputSchema: {} }, async () => {
    try {
      const cfg = await loadConfig(opts.root);
      return { content: [text(JSON.stringify(cfg.peons.map((p) => ({ name: `${p.name}@${p.version}`, description: p.manifest.description, paths: p.paths, block: p.block, enabled: p.enabled, checks: p.checks.map((c) => c.id) })), null, 2))] };
    } catch (e) {
      return { content: [text("error: " + errorMessage(e))], isError: true };
    }
  });
  const scopeShape = { scope: z.enum(["staged", "branch", "files"]).default("staged"), base: z.string().optional(), files: z.array(z.string()).optional() };
  server.registerTool("plan", { description: "Show which peons would run on a change set without calling a model", inputSchema: scopeShape }, async (a) => {
    try {
      const cfg = await loadConfig(opts.root);
      const changes = await computeChangeSet(opts.root, scopeOf(a.scope, a.base, a.files));
      return { content: [text(JSON.stringify(await new PathPlanner().plan(cfg, changes), null, 2))] };
    } catch (e) {
      return { content: [text("error: " + errorMessage(e))], isError: true };
    }
  });
  server.registerTool("run_peons", {
    description: "Run peons on a change set. Returns fix instructions (agent format) and the JSON result. Exit 0 = nothing blocking, 1 = blocking finding, 2 = engine error.",
    inputSchema: { ...scopeShape, names: z.array(z.string()).optional(), failOn: SeveritySchema.optional(), allFiles: z.boolean().optional() },
  }, async (a) => {
    try {
      const result = await run({ root: opts.root, scope: scopeOf(a.scope, a.base, a.files), names: a.names, failOn: a.failOn, allFiles: a.allFiles, surface: "mcp", provider: opts.provider });
      return { content: [text(formatAgent(result)), text(JSON.stringify(result))], isError: result.exit === 2 };
    } catch (e) {
      return { content: [text("error: " + errorMessage(e))], isError: true };
    }
  });
  return server;
}
