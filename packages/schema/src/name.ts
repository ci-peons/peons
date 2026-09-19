const PART = /^[a-z0-9][a-z0-9._-]*$/;
export type NameResult = { ok: true; scope: string | null; base: string } | { ok: false; reason: string };
export function validatePeonName(name: string): NameResult {
  if (name.length === 0) return { ok: false, reason: "name is empty" };
  if (name.length > 214) return { ok: false, reason: "name exceeds 214 characters" };
  if (name !== name.toLowerCase()) return { ok: false, reason: "name must be lowercase" };
  if (encodeURIComponent(name.replace(/^@/, "").replace("/", "")) !== name.replace(/^@/, "").replace("/", "")) return { ok: false, reason: "name must be URL-safe" };
  if (name.startsWith("@")) {
    const [scope, base, ...rest] = name.slice(1).split("/");
    if (!scope || !base || rest.length) return { ok: false, reason: "scoped name must be @scope/name" };
    if (!PART.test(scope) || !PART.test(base)) return { ok: false, reason: "invalid characters in name" };
    return { ok: true, scope, base };
  }
  if (!PART.test(name)) return { ok: false, reason: "invalid characters in name" };
  return { ok: true, scope: null, base: name };
}
