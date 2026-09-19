import React, { useEffect, useState } from "react";
import { render, Box, Text, Static } from "ink";
import Spinner from "ink-spinner";
import { run, type RunOptions, type RunEvent } from "@peons/core";
import type { RunResult, Finding } from "@peons/schema";
import { INK_COLOR } from "./colors.ts";

export type Row = { name: string; version: string; files: number; status: "running" | "ok" | "cached" | "error"; startedAt: number; durationMs?: number; findings: number; tokens?: number; error?: string };

function FindingBlock({ f }: { f: Finding }) {
  const loc = f.range[0] === f.range[1] ? `${f.range[0]}` : `${f.range[0]}-${f.range[1]}`;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text><Text color={INK_COLOR[f.severity]} bold>[{f.severity.toUpperCase()}]</Text> {f.file}:{loc} <Text dimColor>· {f.peon.name}/{f.check}</Text></Text>
      <Text>{f.message}</Text>
      <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">{f.evidence.map((l, i) => <Text key={i} dimColor>{l}</Text>)}</Box>
      {f.fix ? <Text><Text color="green">Fix:</Text> {f.fix}</Text> : null}
    </Box>
  );
}
export function RunView({ rows, result }: { rows: Row[]; result: RunResult | null }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(t); }, []);
  return (
    <Box flexDirection="column">
      {rows.map((r) => (
        <Text key={r.name}>
          {r.status === "running" ? <Text color="yellow"><Spinner type="dots" /></Text> : r.status === "error" ? <Text color="red">✗</Text> : <Text color="green">✓</Text>}{" "}
          <Text bold>{r.name}@{r.version}</Text> <Text dimColor>{r.files} file{r.files === 1 ? "" : "s"}</Text>{" "}
          <Text dimColor>{(((r.durationMs ?? Date.now() - r.startedAt)) / 1000).toFixed(1)}s</Text>
          {r.tokens !== undefined ? <Text dimColor> · {r.tokens} tok</Text> : null}
          {r.status === "cached" ? <Text dimColor> · cached</Text> : null}
          {r.status !== "running" ? <Text> · {r.findings} finding{r.findings === 1 ? "" : "s"}</Text> : null}
          {r.error ? <Text color="red"> {r.error}</Text> : null}
        </Text>
      ))}
      {result ? (
        <Box flexDirection="column" marginTop={1}>
          <Static items={result.findings}>{(f) => <FindingBlock key={f.fingerprint} f={f} />}</Static>
          <Text>{result.findings.length} finding{result.findings.length === 1 ? "" : "s"} · exit {result.exit}{result.redactions ? ` · ${result.redactions} redaction(s)` : ""}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
export async function renderRun(opts: Omit<RunOptions, "onEvent">): Promise<number> {
  const rows: Row[] = []; let result: RunResult | null = null;
  const app = render(<RunView rows={rows} result={result} />);
  const redraw = () => app.rerender(<RunView rows={[...rows]} result={result} />);
  const onEvent = (e: RunEvent) => {
    if (e.type === "peon:start") rows.push({ name: e.name, version: e.version, files: e.files, status: "running", startedAt: Date.now(), findings: 0 });
    if (e.type === "peon:done") { const r = rows.find((x) => x.name === e.status.name)!; r.status = e.status.status === "skipped" ? "ok" : e.status.status; r.durationMs = e.status.durationMs; r.findings = e.status.findings; r.tokens = e.status.usage ? e.status.usage.inputTokens + e.status.usage.outputTokens : undefined; r.error = e.status.error; }
    if (e.type === "done") result = e.result;
    redraw();
  };
  try { const r = await run({ ...opts, onEvent }); await new Promise((res) => setTimeout(res, 50)); app.unmount(); return r.exit; }
  catch (e) { app.unmount(); throw e; }
}
