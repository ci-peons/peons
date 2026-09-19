import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { PeonEvent } from "@peons/schema";
export function journalFileFor(d: Date): string { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}.jsonl`; }
export class Journal {
  constructor(private dir: string, private enabled: boolean) {}
  async append(event: PeonEvent): Promise<void> {
    if (!this.enabled) return;
    await mkdir(this.dir, { recursive: true });
    await appendFile(join(this.dir, journalFileFor(new Date(event.at))), JSON.stringify(event) + "\n");
  }
}
