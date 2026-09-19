import { severityRank, type Finding } from "@peons/schema";
const overlaps = (a: [number, number], b: [number, number]) => a[0] <= b[1] && b[0] <= a[1];
export function mergeFindings(all: Finding[]): Finding[] {
  const kept: Finding[] = [];
  for (const f of all) {
    const dup = kept.findIndex((k) => k.file === f.file && k.check === f.check && overlaps(k.range, f.range));
    if (dup === -1) kept.push(f);
    else if (severityRank(f.severity) > severityRank(kept[dup]!.severity)) kept[dup] = f;
  }
  return kept.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.file.localeCompare(b.file) || a.range[0] - b.range[0]);
}
