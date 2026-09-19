import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { ExpectSchema, type CheckScore, type TestResult, type PeonRunStatus } from "@peons/schema";
import { loadConfig, type ResolvedConfig, type ResolvedPeon } from "./config.ts";
import { run } from "./run.ts";
import type { Provider } from "./provider/types.ts";
import { EngineError } from "./errors.ts";

export type TestEvent =
  | { type: "fixture:done"; peon: string; fixture: string; kind: "should-flag" | "should-pass"; fired: string[] }
  | { type: "done"; result: TestResult };
export type TestOptions = { root: string; names?: string[]; runs?: number; minPrecision?: number; minRecall?: number; provider?: Provider; onEvent?: (e: TestEvent) => void };

type Fixture = { kind: "should-flag" | "should-pass"; path: string; expected: string[] };

async function listFixtures(peon: ResolvedPeon): Promise<Fixture[]> {
  const out: Fixture[] = [];
  for (const kind of ["should-flag", "should-pass"] as const) {
    const dir = join(peon.dir, "fixtures", kind);
    let names: string[] = []; try { names = (await readdir(dir)).sort(); } catch { continue; }
    for (const n of names) {
      if (n.endsWith(".expect.yaml")) continue;
      let expected: string[] = [];
      if (kind === "should-flag") {
        const ex = join(dir, n.replace(/\.[^.]+$/, "") + ".expect.yaml");
        let raw: string; try { raw = await readFile(ex, "utf8"); } catch { throw new EngineError("FIXTURE", `${peon.name}: missing ${relative(peon.dir, ex)}`); }
        const parsed = ExpectSchema.safeParse(parseYaml(raw));
        if (!parsed.success) throw new EngineError("FIXTURE", `${peon.name}: invalid ${relative(peon.dir, ex)}`);
        for (const c of parsed.data.checks) if (!peon.checks.some((k) => k.id === c)) throw new EngineError("FIXTURE", `${peon.name}: ${relative(peon.dir, ex)} expects unknown check "${c}"`);
        expected = parsed.data.checks;
      }
      out.push({ kind, path: join(dir, n), expected });
    }
  }
  return out;
}

function fixtureConfig(cfg: ResolvedConfig, peon: ResolvedPeon): ResolvedConfig {
  const widened: ResolvedPeon = { ...peon, paths: ["**"], block: "critical", manifest: { ...peon.manifest, permissions: { read: ["**"] }, context: { docs: [], tests: [] } } };
  return { ...cfg, journal: false, peons: [widened] };
}

export async function testPeons(opts: TestOptions): Promise<TestResult> {
  const emit = opts.onEvent ?? (() => {});
  const cfg = await loadConfig(opts.root);
  const peons = cfg.peons.filter((p) => !opts.names || opts.names.includes(p.name));
  const runs = Math.max(1, opts.runs ?? 1);
  const scores = new Map<string, CheckScore>();
  const statuses: PeonRunStatus[] = [];
  for (const peon of peons) {
    for (const c of peon.checks) scores.set(`${peon.name}/${c.id}`, { peon: peon.name, check: c.id, expected: 0, fired: 0, truePositives: 0, recall: null, precision: null });
    const fixtures = await listFixtures(peon);
    const fcfg = fixtureConfig(cfg, peon);
    for (const fx of fixtures) {
      const counts = new Map<string, number>();
      for (let i = 0; i < runs; i++) {
        const r = await run({ root: peon.dir, scope: { kind: "files", paths: [relative(peon.dir, fx.path)] }, surface: "cli", provider: opts.provider, config: { ...fcfg, root: peon.dir }, noCache: true });
        statuses.push(...r.peons);
        for (const id of new Set(r.findings.map((f) => f.check))) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const fired = [...counts.entries()].filter(([, n]) => n * 2 > runs).map(([id]) => id);
      emit({ type: "fixture:done", peon: peon.name, fixture: relative(peon.dir, fx.path), kind: fx.kind, fired });
      for (const id of fx.expected) scores.get(`${peon.name}/${id}`)!.expected++;
      for (const id of fired) { const s = scores.get(`${peon.name}/${id}`)!; s.fired++; if (fx.expected.includes(id)) s.truePositives++; }
    }
  }
  const checks = [...scores.values()].map((s) => ({ ...s, recall: s.expected ? s.truePositives / s.expected : null, precision: s.fired ? s.truePositives / s.fired : null }));
  const sum = (k: "expected" | "fired" | "truePositives") => checks.reduce((n, c) => n + c[k], 0);
  const recall = sum("expected") ? sum("truePositives") / sum("expected") : 1;
  const precision = sum("fired") ? sum("truePositives") / sum("fired") : 1;
  const minP = opts.minPrecision ?? 0.85, minR = opts.minRecall ?? 0.7;
  const failures: string[] = [];
  if (recall < minR) failures.push(`recall ${recall.toFixed(2)} below ${minR}`);
  if (precision < minP) failures.push(`precision ${precision.toFixed(2)} below ${minP}`);
  for (const s of statuses) if (s.status === "error") failures.push(`${s.name}: ${s.error}`);
  const result: TestResult = { checks, precision, recall, passed: failures.length === 0, failures, peons: statuses };
  emit({ type: "done", result });
  return result;
}
