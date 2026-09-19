import React from "react";
import { render, Box, Text } from "ink";
import Spinner from "ink-spinner";
import { testPeons, type TestOptions, type TestEvent } from "@peons/core";
import type { TestResult } from "@peons/schema";

type Line = { peon: string; fixture: string; kind: string; fired: string[] };
export function TestView({ lines, result }: { lines: Line[]; result: TestResult | null }) {
  const pct = (n: number | null) => (n === null ? " n/a" : `${(n * 100).toFixed(0).padStart(3)}%`);
  return (
    <Box flexDirection="column">
      {lines.map((l, i) => <Text key={i}><Text color={l.kind === "should-flag" ? (l.fired.length ? "green" : "red") : l.fired.length ? "red" : "green"}>{l.kind === "should-flag" ? (l.fired.length ? "✓" : "✗") : l.fired.length ? "✗" : "✓"}</Text> <Text dimColor>{l.peon}</Text> {l.kind}/{l.fixture} <Text dimColor>{l.fired.join(", ")}</Text></Text>)}
      {!result ? <Text color="yellow"><Spinner type="dots" /> running fixtures</Text> : (
        <Box flexDirection="column" marginTop={1}>
          {result.checks.map((c) => <Text key={c.peon + c.check}>{(c.peon + "/" + c.check).padEnd(32)} recall {pct(c.recall)}  precision {pct(c.precision)}  <Text dimColor>({c.truePositives}/{c.expected} expected, {c.fired} fired)</Text></Text>)}
          <Text bold color={result.passed ? "green" : "red"}>{result.passed ? "PASS" : "FAIL"} recall {pct(result.recall)} precision {pct(result.precision)}</Text>
          {result.failures.map((f, i) => <Text key={i} color="red">  {f}</Text>)}
        </Box>
      )}
    </Box>
  );
}
export async function renderTest(opts: Omit<TestOptions, "onEvent">): Promise<number> {
  const lines: Line[] = []; let result: TestResult | null = null;
  const app = render(<TestView lines={lines} result={result} />);
  const onEvent = (e: TestEvent) => { if (e.type === "fixture:done") lines.push(e); if (e.type === "done") result = e.result; app.rerender(<TestView lines={[...lines]} result={result} />); };
  try { const r = await testPeons({ ...opts, onEvent }); await new Promise((res) => setTimeout(res, 50)); app.unmount(); return r.passed ? 0 : 1; }
  catch (e) { app.unmount(); throw e; }
}
