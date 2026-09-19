import { test, expect } from "bun:test";
import { redactText } from "./redact.ts";

test("known formats", () => {
  const r = redactText([
    "AKIAIOSFODNN7EXAMPLE",
    "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
    "sk_live_4eC39HqLyjWDarjtT1zdp7dc",
    "xoxb-1234567890-ABCDEFGHIJKLMNOPQRSTUVWX",
    "AIzaSyA-1234567890abcdefghijklmnopqrstu",
    "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----",
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEFghiJKLmnoPQRstuVWXyz",
  ].join("\n"));
  expect(r.count).toBe(7);
  expect(r.text).toContain("<REDACTED:aws-access-key>");
  expect(r.text).toContain("<REDACTED:github-token>");
  expect(r.text).toContain("<REDACTED:private-key>");
  expect(r.text).not.toContain("AKIA");
});
test("high-entropy assignment to a secret-like name", () => {
  const r = redactText(`const apiKey = "q8Zk2mN7pL4vX9wR3tY6uB1cD5fG0hJa";\nconst label = "hello world this is fine";`);
  expect(r.count).toBe(1);
  expect(r.text).toContain('apiKey = "<REDACTED:high-entropy>"');
  expect(r.text).toContain("hello world this is fine");
});
test("plain code untouched", () => {
  const src = "export function add(a: number, b: number) { return a + b; }";
  expect(redactText(src)).toEqual({ text: src, count: 0 });
});
