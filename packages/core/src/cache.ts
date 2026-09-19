import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Finding } from "@peons/schema";
export function cacheKey(peonHash: string, packHash: string, model: string): string {
  return createHash("sha256").update(`${peonHash}\n${packHash}\n${model}`).digest("hex");
}
export class FindingsCache {
  constructor(private dir: string) {}
  async get(key: string): Promise<Finding[] | null> {
    try { return JSON.parse(await readFile(join(this.dir, key + ".json"), "utf8")) as Finding[]; } catch { return null; }
  }
  async set(key: string, findings: Finding[]): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, key + ".json"), JSON.stringify(findings));
  }
}
