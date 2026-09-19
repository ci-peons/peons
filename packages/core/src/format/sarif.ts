import type { RunResult, Severity } from "@peons/schema";
const LEVEL: Record<Severity, string> = { info: "note", low: "note", medium: "warning", high: "error", critical: "error" };
export function formatSarif(r: RunResult): string {
  const rules = new Map<string, { id: string; name: string; shortDescription: { text: string }; properties: { peon: string; version: string } }>();
  for (const f of r.findings) { const id = `${f.peon.name}/${f.check}`; if (!rules.has(id)) rules.set(id, { id, name: f.check, shortDescription: { text: `${f.peon.name}: ${f.check}` }, properties: { peon: f.peon.name, version: f.peon.version } }); }
  return JSON.stringify({
    $schema: "https://json.schemastore.org/sarif-2.1.0.json", version: "2.1.0",
    runs: [{ tool: { driver: { name: "peons", informationUri: "https://peons.dev", rules: [...rules.values()] } },
      results: r.findings.map((f) => ({
        ruleId: `${f.peon.name}/${f.check}`, level: LEVEL[f.severity],
        message: { text: f.fix ? `${f.message}\n\nFix: ${f.fix}` : f.message },
        locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.range[0], endLine: f.range[1] } } }],
        partialFingerprints: { primary: f.fingerprint },
      })) }],
  }, null, 2) + "\n";
}
