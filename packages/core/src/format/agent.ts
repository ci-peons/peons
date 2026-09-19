import { SEVERITIES, type RunResult } from "@peons/schema";
export function exitMeaning(exit: 0 | 1 | 2): string {
  return exit === 0 ? "no finding meets the block severity" : exit === 1 ? "at least one finding meets the block severity" : "engine error, see peon statuses";
}
const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
/** A fence that cannot be closed early by backticks inside the evidence itself. */
export function evidenceFence(evidence: string[]): string {
  let longest = 0;
  for (const line of evidence) for (const run of line.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  return "`".repeat(Math.max(3, longest + 1));
}
export function formatAgent(r: RunResult): string {
  const out: string[] = [];
  const ran = r.peons.filter((p) => p.status !== "skipped").length;
  out.push(`# peons: ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"} from ${ran} peon${ran === 1 ? "" : "s"} in ${secs(r.durationMs)}`, "");
  for (const f of r.findings) {
    const loc = f.range[0] === f.range[1] ? `${f.range[0]}` : `${f.range[0]}-${f.range[1]}`;
    const fence = evidenceFence(f.evidence);
    out.push(`## [${f.severity.toUpperCase()}] ${f.file}:${loc} · ${f.peon.name}/${f.check}`, f.message, fence, ...f.evidence, fence);
    if (f.fix) out.push(`Fix: ${f.fix}`);
    out.push("");
  }
  out.push("---");
  out.push("Summary: " + [...SEVERITIES].reverse().map((s) => `${s} ${r.findings.filter((f) => f.severity === s).length}`).join(" · "));
  out.push("Peons: " + r.peons.map((p) => {
    const u = p.usage ? ` (${secs(p.durationMs)}, ${p.usage.inputTokens} in / ${p.usage.outputTokens} out, ${p.usage.cacheReadTokens} cached)` : p.status === "cached" ? " (cached)" : p.error ? `: ${p.error}` : "";
    return `${p.name}@${p.version} ${p.status}${u}`;
  }).join("; "));
  if (r.redactions) out.push(`Redactions: ${r.redactions}`);
  if (r.warnings.length) out.push("Warnings: " + r.warnings.join("; "));
  if (r.dropped.length) out.push(`Dropped: ${r.dropped.map((d) => `${d.item} (${d.reason})`).join("; ")}`);
  out.push(`Exit code ${r.exit}: ${exitMeaning(r.exit)}`);
  return out.join("\n") + "\n";
}
