import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { redactText } from "@peons/core";
import { MAX_INTENT_CHARS } from "./state.ts";

const run = promisify(execFile);

export async function resolveIntent(root: string, explicit?: string): Promise<string | undefined> {
  let text = explicit?.trim();
  if (!text) {
    try { text = (await run("git", ["log", "-1", "--format=%B"], { cwd: root })).stdout.trim(); }
    catch { text = undefined; }
  }
  if (!text) return undefined;
  return redactText(text).text.slice(0, MAX_INTENT_CHARS);
}
