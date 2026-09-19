import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { EngineError } from "./errors.ts";
const run = promisify(execFile);

export async function git(root: string, args: string[]): Promise<string> {
  try { const { stdout } = await run("git", args, { cwd: root, maxBuffer: 64 * 1024 * 1024 }); return stdout; }
  catch (e) { throw new EngineError("GIT", `git ${args.join(" ")} failed: ${(e as Error & { stderr?: string }).stderr ?? (e as Error).message}`); }
}
export async function gitHeadSha(root: string): Promise<string> {
  try { return (await git(root, ["rev-parse", "HEAD"])).trim(); } catch { return "nogit"; }
}
export async function defaultBase(root: string): Promise<string> {
  try { return (await git(root, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])).trim(); } catch { return "main"; }
}
