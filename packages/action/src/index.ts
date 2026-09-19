import * as core from "@actions/core";
import * as github from "@actions/github";
import { writeFile } from "node:fs/promises";
import { run, buildReviewPayload, formatSarif, formatAgent, EngineError } from "@peons/core";
import { SeveritySchema } from "@peons/schema";
import { diffLinesFromPatch, existingFingerprints } from "./review.ts";

async function main() {
  process.env.PEONS_API_KEY = core.getInput("api-key", { required: true });
  const scopeIn = core.getInput("scope") || "branch";
  const pr = github.context.payload.pull_request;
  const base = core.getInput("base") || pr?.base?.ref;
  const failOnIn = core.getInput("fail-on"); const failOn = failOnIn ? SeveritySchema.parse(failOnIn) : undefined;
  const names = core.getInput("peons").split(/\s+/).filter(Boolean);
  if (scopeIn === "branch" && base) await core.group("fetch base", async () => { const { execFile } = await import("node:child_process"); await new Promise<void>((res, rej) => execFile("git", ["fetch", "--no-tags", "--depth=1", "origin", base], (e) => (e ? rej(e) : res()))); });
  const scope = scopeIn === "staged" ? { kind: "staged" as const } : { kind: "branch" as const, base: base ? `origin/${base}` : undefined };
  const result = await run({ root: process.cwd(), scope, names: names.length ? names : undefined, failOn, surface: "ci" });
  core.info(formatAgent(result));
  core.setOutput("exit-code", String(result.exit)); core.setOutput("findings", String(result.findings.length));
  if (core.getBooleanInput("sarif")) { await writeFile("peons.sarif", formatSarif(result)); core.info("wrote peons.sarif"); }
  if (pr) {
    const octokit = github.getOctokit(core.getInput("github-token"));
    const { owner, repo } = github.context.repo; const pull_number = pr.number;
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, { owner, repo, pull_number, per_page: 100 });
    const comments = await octokit.paginate(octokit.rest.pulls.listReviewComments, { owner, repo, pull_number, per_page: 100 });
    const payload = buildReviewPayload(result, { existingFingerprints: existingFingerprints(comments), diffLines: diffLinesFromPatch(files) });
    if (payload.comments.length || result.findings.length) {
      const params = { owner, repo, pull_number, event: payload.event, body: payload.body, comments: payload.comments.map((c) => ({ ...c, side: "RIGHT" as const })) };
      try {
        await octokit.rest.pulls.createReview(params);
      } catch (e) {
        // GitHub rejects REQUEST_CHANGES reviews from the PR author with a 422; retry as a
        // plain comment so the run still surfaces findings instead of failing outright.
        if (params.event === "REQUEST_CHANGES" && (e as { status?: number }).status === 422) {
          await octokit.rest.pulls.createReview({ ...params, event: "COMMENT" });
        } else {
          throw e;
        }
      }
    }
  }
  if (result.exit === 2) { if (core.getBooleanInput("soft-fail")) core.warning("peons: engine error (soft-fail)"); else core.setFailed("peons: engine error"); }
  else if (result.exit === 1) core.setFailed(`peons: ${result.findings.length} finding(s) meet the block severity`);
}
main().catch((e) => { if (e instanceof EngineError && core.getBooleanInput("soft-fail")) core.warning(e.message); else core.setFailed(e instanceof Error ? e.message : String(e)); });
