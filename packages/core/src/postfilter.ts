import { RawFindingsSchema, fingerprint, type Finding, type DroppedItem } from "@peons/schema";
import type { ContextPack } from "./context.ts";

const INJECTION = [
  /ignore (all |any )?(previous|prior|above) instructions/i,
  /\brun\b[^.]{0,40}`[^`]+`/i,
  /\b(rm -rf|curl |wget |chmod |sudo )/i,
  /\b(visit|open|fetch|go to)\b[^.]{0,30}https?:\/\//i,
  /\b(edit|modify|delete|create)\b[^.]{0,40}\b(file|files)\b[^.]{0,40}\b(outside|other than|not in)\b/i,
];
function lineCount(content: string): number { const n = content.split("\n").length; return content.endsWith("\n") ? n - 1 : n; }

export function postFilter(raw: unknown, pack: ContextPack): { findings: Finding[]; dropped: DroppedItem[] } {
  const dropped: DroppedItem[] = []; const findings: Finding[] = [];
  const parsed = RawFindingsSchema.safeParse(raw);
  if (!parsed.success) { dropped.push({ peon: pack.peon.name, item: "model output", reason: "did not match findings schema: " + parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ") }); return { findings, dropped }; }
  const checkIds = new Set(pack.peon.checks.map((c) => c.id));
  const files = new Map(pack.files.map((f) => [f.path, f]));
  for (const r of parsed.data.findings) {
    const item = `${r.file}:${r.range[0]} ${r.check}`;
    if (!checkIds.has(r.check)) { dropped.push({ peon: pack.peon.name, item, reason: "unknown check" }); continue; }
    const file = files.get(r.file);
    if (!file) { dropped.push({ peon: pack.peon.name, item, reason: "file not in pack" }); continue; }
    const n = lineCount(file.content);
    if (r.range[0] > r.range[1] || r.range[1] > n) { dropped.push({ peon: pack.peon.name, item, reason: "range outside file" }); continue; }
    if (INJECTION.some((re) => re.test(r.message) || (r.fix ? re.test(r.fix) : false))) { dropped.push({ peon: pack.peon.name, item, reason: "instruction-shaped message" }); continue; }
    const evidence = r.evidence.slice(0, 8);
    findings.push({
      peon: { name: pack.peon.name, version: pack.peon.version, hash: pack.peon.hash },
      check: r.check, file: r.file, range: r.range, severity: r.severity ?? pack.peon.manifest.severity.default,
      message: r.message, evidence, fix: r.fix, fingerprint: fingerprint(r.check, evidence),
    });
  }
  return { findings, dropped };
}
