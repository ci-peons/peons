export type PeonCheck = { id: string; title: string; description: string };
export class PeonParseError extends Error {
  constructor(public issues: string[]) { super(issues.join("; ")); this.name = "PeonParseError"; }
}
const CHECK_ID = /^[a-z0-9-]+$/;

export function parsePeonBody(md: string): { guidance: string; checks: PeonCheck[] } {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const checksIdx = lines.findIndex((l) => /^##\s+Checks\s*$/.test(l));
  if (checksIdx === -1) throw new PeonParseError(["body has no '## Checks' section"]);
  const guidance = lines.slice(0, checksIdx).join("\n").trim();
  const checks: PeonCheck[] = [];
  const issues: string[] = [];
  let current: PeonCheck | null = null;
  const buf: string[] = [];
  const flush = () => { if (current) { current.description = buf.join("\n").trim(); checks.push(current); } buf.length = 0; };
  for (const line of lines.slice(checksIdx + 1)) {
    const m = /^###\s+(.+?)\s*$/.exec(line);
    if (m) {
      flush();
      const id = m[1]!;
      if (!CHECK_ID.test(id)) issues.push(`check id "${id}" must match ${CHECK_ID}`);
      if (checks.some((c) => c.id === id)) issues.push(`duplicate check id "${id}"`);
      current = { id, title: id, description: "" };
    } else if (/^##\s+/.test(line)) {
      flush(); current = null; // a new H2 ends the checks section
    } else if (current) {
      buf.push(line);
    }
  }
  flush();
  if (checks.length === 0) issues.push("peon must define at least one check under '## Checks'");
  if (issues.length) throw new PeonParseError(issues);
  return { guidance, checks };
}
