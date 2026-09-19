import * as core from "@actions/core";
import * as github from "@actions/github";
import { writeFile } from "node:fs/promises";
import { run, buildReviewPayload, formatSarif, formatAgent, EngineError } from "@peons/core";
import { SeveritySchema } from "@peons/schema";
import { diffLinesFromPatch, existingFingerprints } from "./review.ts";

async function git(args: string[]): Promise<void> {
  const { execFile } = await import("node:child_process");
  await new Promise<void>((res, rej) => execFile("git", args, (e) => (e ? rej(e) : res())));
}

async function main() {
  const apiKey = core.getInput("api-key", { required: true });
  core.setSecret(apiKey);
  process.env.PEONS_API_KEY = apiKey;
  const scopeIn = core.getInput("scope") || "branch";
  const pr = github.context.payload.pull_request;
  const base = core.getInput("base") || pr?.base?.ref;
  const failOnIn = core.getInput("fail-on"); const failOn = failOnIn ? SeveritySchema.parse(failOnIn) : undefined;
  const names = core.getInput("peons").split(/\s+/).filter(Boolean);
  if (scopeIn === "branch" && base) {
    await core.group("fetch base", () => git(["fetch", "--no-tags", "--depth=1", "origin", `+refs/heads/${base}:refs/remotes/origin/${base}`]));
    try {
      await git(["merge-base", `origin/${base}`, "HEAD"]);
    } catch {
      core.setFailed(`peons: no merge base between origin/${base} and HEAD. Set fetch-depth: 0 on actions/checkout so the base branch history is available.`);
      return;
    }
  }
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
    const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, { owner, repo, pull_number, per_page: 100 });
    const existing = existingFingerprints([...comments, ...reviews.map((r) => ({ body: r.body ?? "" }))]);
    const payload = buildReviewPayload(result, { existingFingerprints: existing, diffLines: diffLinesFromPatch(files) });
    const newCount = result.findings.filter((f) => !existing.has(f.fingerprint)).length;
    if (newCount > 0) {
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
