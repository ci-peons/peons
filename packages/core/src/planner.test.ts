import { test, expect } from "bun:test";
import { PathPlanner } from "./planner.ts";
import type { ResolvedConfig, ResolvedPeon } from "./config.ts";
import type { ChangeSet } from "./changeset.ts";

const peon = (name: string, paths: string[], enabled = true): ResolvedPeon => ({
  name, version: "1.0.0", hash: "h", dir: "/x", source: { kind: "local", dir: "/x" },
  manifest: {} as never, guidance: "", checks: [{ id: "c", title: "c", description: "" }], body: "",
  paths, block: "high", enabled, reason: enabled ? undefined : "off",
});
const cfg = { peons: [peon("a11y", ["**/*.tsx"]), peon("sql", ["db/**"]), peon("off", ["**"], false)] } as ResolvedConfig;
const changes = { files: [{ path: "apps/x.tsx" }, { path: "README.md" }] } as ChangeSet;

test("matches files to peons by glob and records reasons", async () => {
  const plan = await new PathPlanner().plan(cfg, changes);
  expect(plan.entries).toEqual([{ peon: "a11y", files: [{ path: "apps/x.tsx", reason: "matched **/*.tsx" }] }]);
  expect(plan.skipped).toEqual([{ peon: "sql", reason: "no changed file matched db/**" }, { peon: "off", reason: "disabled: off" }]);
});
test("names restrict; allFiles bypasses matching for named peons", async () => {
  const p1 = await new PathPlanner().plan(cfg, changes, { names: ["sql"] });
  expect(p1.entries).toEqual([]);
  const p2 = await new PathPlanner().plan(cfg, changes, { names: ["sql"], allFiles: true });
  expect(p2.entries[0]!.files.map((f) => f.path)).toEqual(["apps/x.tsx", "README.md"]);
});
test("unknown name is skipped with reason", async () => {
  const p = await new PathPlanner().plan(cfg, changes, { names: ["nope"] });
  expect(p.skipped).toContainEqual({ peon: "nope", reason: "not configured in peons.yaml" });
});
