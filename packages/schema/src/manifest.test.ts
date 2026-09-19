import { test, expect } from "bun:test";
import { PeonManifestSchema } from "./manifest.ts";

const base = {
  name: "a11y", version: "1.0.0", description: "d", paths: ["**/*.tsx"],
  severity: { default: "medium", block: "high" },
  permissions: { read: ["**/*.tsx", "docs/**"] },
};
test("minimal valid manifest fills defaults", () => {
  const m = PeonManifestSchema.parse(base);
  expect(m.model.tier).toBe("fast");
  expect(m.context.docs).toEqual([]);
});
test("block below default fails", () => {
  expect(PeonManifestSchema.safeParse({ ...base, severity: { default: "high", block: "low" } }).success).toBe(false);
});
test("context outside permissions fails", () => {
  expect(PeonManifestSchema.safeParse({ ...base, context: { docs: ["adr/**"] } }).success).toBe(false);
  expect(PeonManifestSchema.safeParse({ ...base, context: { docs: ["docs/a11y/**"] } }).success).toBe(true);
});
test("bad name and version fail", () => {
  expect(PeonManifestSchema.safeParse({ ...base, name: "Bad Name" }).success).toBe(false);
  expect(PeonManifestSchema.safeParse({ ...base, version: "1.0" }).success).toBe(false);
});
test("globs must stay inside the repository", () => {
  for (const bad of ["../**", "/etc/**", "docs/../**", "..", "a/../../b"]) {
    const r = PeonManifestSchema.safeParse({ ...base, paths: [bad] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toBe('globs must be relative to the repository and must not contain ".."');
  }
  for (const bad of ["../**", "/etc/**"]) {
    expect(PeonManifestSchema.safeParse({ ...base, permissions: { read: [bad] } }).success).toBe(false);
    expect(PeonManifestSchema.safeParse({ ...base, context: { docs: [bad] } }).success).toBe(false);
    expect(PeonManifestSchema.safeParse({ ...base, context: { tests: [bad] } }).success).toBe(false);
  }
  for (const ok of ["docs/**", "**/*.tsx", "src/a..b/**"]) {
    expect(PeonManifestSchema.safeParse({ ...base, paths: [ok], permissions: { read: [ok] } }).success).toBe(true);
  }
});
