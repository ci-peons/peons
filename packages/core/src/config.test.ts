import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./config.ts";
import { hashPeonDir } from "./pack.ts";
import { EngineError } from "./errors.ts";

const PEON = `---
name: a11y
version: 1.0.0
description: d
paths: ["**/*.tsx"]
permissions:
  read: ["**/*.tsx"]
---
## Checks
### img-alt
x
`;
function repo(yaml: string, opts: { installed?: boolean; lockIntegrity?: string } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "repo-"));
  writeFileSync(join(root, "peons.yaml"), yaml);
  mkdirSync(join(root, "peons/local-peon"), { recursive: true });
  writeFileSync(join(root, "peons/local-peon/peon.md"), PEON.replace("name: a11y", "name: local-peon"));
  if (opts.installed) {
    mkdirSync(join(root, ".peons/installed/a11y/1.0.0"), { recursive: true });
    writeFileSync(join(root, ".peons/installed/a11y/1.0.0/peon.md"), PEON);
  }
  return root;
}

test("resolves a local peon and applies overrides", async () => {
  const root = repo(`peons:\n  - use: ./peons/local-peon\n    paths: ["apps/**"]\n    severity: { block: critical }\n`);
  const cfg = await loadConfig(root);
  expect(cfg.peons[0]!.paths).toEqual(["apps/**"]);
  expect(cfg.peons[0]!.block).toBe("critical");
  expect(cfg.models.fast).toBe("claude-haiku-4-5-20251001");
  expect(cfg.budget.tokensPerPeon).toBe(60000);
});
test("resolves an installed peon when lock matches", async () => {
  const root = repo(`peons:\n  - use: a11y\n`, { installed: true });
  const integrity = await hashPeonDir(join(root, ".peons/installed/a11y/1.0.0"));
  writeFileSync(join(root, "peons.lock"), `lockfile: 1\npackages:\n  a11y:\n    version: 1.0.0\n    integrity: ${integrity}\n    permissions:\n      read: ["**/*.tsx"]\n`);
  const cfg = await loadConfig(root);
  expect(cfg.peons[0]!.source.kind).toBe("installed");
  expect(cfg.peons[0]!.hash).toBe(integrity);
});
test("installed peon with wrong integrity is an EngineError", async () => {
  const root = repo(`peons:\n  - use: a11y\n`, { installed: true });
  writeFileSync(join(root, "peons.lock"), `lockfile: 1\npackages:\n  a11y:\n    version: 1.0.0\n    integrity: sha256-bogus\n    permissions:\n      read: ["**/*.tsx"]\n`);
  await expect(loadConfig(root)).rejects.toBeInstanceOf(EngineError);
});
test("installed peon with mismatched permissions is an EngineError", async () => {
  const root = repo(`peons:\n  - use: a11y\n`, { installed: true });
  const integrity = await hashPeonDir(join(root, ".peons/installed/a11y/1.0.0"));
  writeFileSync(join(root, "peons.lock"), `lockfile: 1\npackages:\n  a11y:\n    version: 1.0.0\n    integrity: ${integrity}\n    permissions:\n      read: ["src/**"]\n`);
  await expect(loadConfig(root)).rejects.toBeInstanceOf(EngineError);
  await expect(loadConfig(root)).rejects.toThrow(/permissions/);
});
test("missing lock entry is an EngineError naming peons add", async () => {
  const root = repo(`peons:\n  - use: a11y\n`);
  await expect(loadConfig(root)).rejects.toThrow(/peons add/);
});
test("disabled peon requires a reason", async () => {
  const root = repo(`peons:\n  - use: ./peons/local-peon\n    enabled: false\n`);
  await expect(loadConfig(root)).rejects.toBeInstanceOf(EngineError);
});
test("missing peons.yaml is an EngineError", async () => {
  await expect(loadConfig(mkdtempSync(join(tmpdir(), "empty-")))).rejects.toThrow(/peons init/);
});
test("two entries resolving to the same peon name are an EngineError", async () => {
  const root = repo(`peons:\n  - use: ./peons/local-peon\n  - use: ./peons/copy\n`);
  mkdirSync(join(root, "peons/copy"), { recursive: true });
  writeFileSync(join(root, "peons/copy/peon.md"), PEON.replace("name: a11y", "name: local-peon"));
  await expect(loadConfig(root)).rejects.toBeInstanceOf(EngineError);
  await expect(loadConfig(root)).rejects.toThrow('peon "local-peon" is configured more than once');
});
test("boss block defaults and overrides", async () => {
  const root = repo(`peons:\n  - use: ./peons/local-peon\n`);
  expect((await loadConfig(root)).boss).toEqual({ enabled: false, provider: "auto", model: "jev-latest", budget: { maxPeons: 5 }, always: [], neverSkip: [], thresholds: { dispatch: 0.7, prune: 0.15 } });
  const root2 = repo(`boss:\n  enabled: true\n  provider: llm\n  budget: { max_peons: 2 }\n  always: [local-peon]\n  never_skip: ["apps/billing/**"]\n  thresholds: { dispatch: 0.8, prune: 0.1 }\npeons:\n  - use: ./peons/local-peon\n`);
  const b = (await loadConfig(root2)).boss;
  expect(b.enabled).toBe(true); expect(b.provider).toBe("llm"); expect(b.budget.maxPeons).toBe(2);
  expect(b.always).toEqual(["local-peon"]); expect(b.neverSkip).toEqual(["apps/billing/**"]); expect(b.thresholds).toEqual({ dispatch: 0.8, prune: 0.1 });
});
test("boss.always must name a configured peon; thresholds are range-checked", async () => {
  await expect(loadConfig(repo(`boss:\n  always: [ghost]\npeons:\n  - use: ./peons/local-peon\n`))).rejects.toThrow(/always.*ghost/);
  await expect(loadConfig(repo(`boss:\n  thresholds: { dispatch: 0.4 }\npeons:\n  - use: ./peons/local-peon\n`))).rejects.toBeInstanceOf(EngineError);
  await expect(loadConfig(repo(`boss:\n  never_skip: ["../**"]\npeons:\n  - use: ./peons/local-peon\n`))).rejects.toBeInstanceOf(EngineError);
});
