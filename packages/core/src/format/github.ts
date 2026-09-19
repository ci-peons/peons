import type { RunResult } from "@peons/schema";
export type ReviewComment = { path: string; line: number; start_line?: number; body: string };
export type ReviewPayload = { event: "COMMENT" | "REQUEST_CHANGES"; body: string; comments: ReviewComment[] };
export const MARKER = (fp: string) => `<!-- peons:fp:${fp} -->`;
export const MARKER_RE = /<!-- peons:fp:([0-9a-f]{64}) -->/g;
export function buildReviewPayload(r: RunResult, opts: { existingFingerprints: Set<string>; diffLines: Map<string, Set<number>> }): ReviewPayload {
  const comments: ReviewComment[] = []; const rest: string[] = [];
  for (const f of r.findings) {
    if (opts.existingFingerprints.has(f.fingerprint)) continue;
    const body = `**[${f.severity.toUpperCase()}] ${f.peon.name}/${f.check}**\n\n${f.message}\n\n\`\`\`\n${f.evidence.join("\n")}\n\`\`\`\n${f.fix ? `\n**Fix:** ${f.fix}\n` : ""}${MARKER(f.fingerprint)}`;
    const lines = opts.diffLines.get(f.file);
    if (lines && lines.has(f.range[1])) comments.push({ path: f.file, line: f.range[1], ...(f.range[0] !== f.range[1] && lines.has(f.range[0]) ? { start_line: f.range[0] } : {}), body });
    else rest.push(`- \`${f.file}:${f.range[0]}\` ${body.replace(/\n/g, "\n  ")}`);
  }
  const header = `peons found ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}.`;
  return { event: r.exit === 1 ? "REQUEST_CHANGES" : "COMMENT", body: rest.length ? `${header}\n\nOutside the diff:\n${rest.join("\n")}` : header, comments };
}
