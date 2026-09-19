import type { ContextPack } from "./context.ts";
import { hashPack } from "./context.ts";

const PATTERNS: Array<[string, RegExp]> = [
  ["private-key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ["aws-access-key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g],
  ["github-token", /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g],
  ["github-pat", /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g],
  ["stripe-key", /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{16,}\b/g],
  ["slack-token", /\bxox[abpors]-[A-Za-z0-9-]{10,}\b/g],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ["openai-key", /\bsk-(proj-)?[A-Za-z0-9]{20,}\b/g],
  ["jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g],
  ["bearer", /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/g],
];
const ASSIGN = /\b([A-Za-z_][A-Za-z0-9_]*(?:key|secret|token|password|passwd|pwd)[A-Za-z0-9_]*)\s*[:=]\s*(["'`])([^"'`\s]{20,})\2/gi;

function entropy(s: string): number {
  const f = new Map<string, number>(); for (const c of s) f.set(c, (f.get(c) ?? 0) + 1);
  let e = 0; for (const n of f.values()) { const p = n / s.length; e -= p * Math.log2(p); } return e;
}
export function redactText(text: string): { text: string; count: number } {
  let count = 0; let out = text;
  for (const [kind, re] of PATTERNS) out = out.replace(re, (m) => { count++; return kind === "bearer" ? `Bearer <REDACTED:bearer>` : `<REDACTED:${kind}>`; });
  out = out.replace(ASSIGN, (m, name: string, q: string, val: string) => {
    if (val.startsWith("<REDACTED:") || entropy(val) < 3.5) return m;
    count++; return `${name} = ${q}<REDACTED:high-entropy>${q}`;
  });
  return { text: out, count };
}
export function redactPack(pack: ContextPack): { pack: ContextPack; count: number } {
  let count = 0;
  const r = (s: string) => { const x = redactText(s); count += x.count; return x.text; };
  const files = pack.files.map((f) => ({ ...f, content: r(f.content), hunks: f.hunks.map((h) => ({ ...h, text: r(h.text) })) }));
  const docs = pack.docs.map((d) => ({ ...d, content: r(d.content) }));
  const tests = pack.tests.map((t) => ({ ...t, content: r(t.content) }));
  const partial = { ...pack, files, docs, tests };
  return { pack: { ...partial, hash: hashPack(partial) }, count };
}
