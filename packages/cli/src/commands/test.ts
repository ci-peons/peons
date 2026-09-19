import { testPeons, type Provider } from "@peons/core";
import type { Ctx } from "../index.ts";
export type TestOpts = { runs?: string; minPrecision?: string; minRecall?: string; format?: string };
export async function testCommand(names: string[], o: TestOpts, ctx: Ctx, deps: { provider?: Provider; tty: boolean }): Promise<number> {
  const opts = { root: ctx.cwd, names: names.length ? names : undefined, runs: o.runs ? Number(o.runs) : undefined, minPrecision: o.minPrecision ? Number(o.minPrecision) : undefined, minRecall: o.minRecall ? Number(o.minRecall) : undefined, provider: deps.provider };
  if (deps.tty) {
    const { renderTest } = await import("../ui/TestView.tsx");
    return renderTest(opts);
  }
  const r = await testPeons({ ...opts, onEvent: (e) => { if (e.type === "fixture:done") ctx.stderr(`${e.peon} ${e.kind}/${e.fixture}: ${e.fired.join(", ") || "-"}\n`); } });
  if (o.format === "json") { ctx.stdout(JSON.stringify(r, null, 2) + "\n"); return r.passed ? 0 : 1; }
  const f = (n: number | null) => (n === null ? "  n/a" : n.toFixed(2).padStart(5));
  ctx.stdout(`CHECK${" ".repeat(28)}EXPECTED  FIRED  TP  recall  precision\n`);
  for (const c of r.checks) ctx.stdout(`${(c.peon + "/" + c.check).padEnd(32)} ${String(c.expected).padStart(8)}  ${String(c.fired).padStart(5)}  ${String(c.truePositives).padStart(2)}  ${f(c.recall)}   ${f(c.precision)}\n`);
  ctx.stdout(`\nrecall ${r.recall.toFixed(2)}  precision ${r.precision.toFixed(2)}  ${r.passed ? "PASS" : "FAIL"}\n`);
  for (const x of r.failures) ctx.stdout(`  ${x}\n`);
  return r.passed ? 0 : 1;
}
