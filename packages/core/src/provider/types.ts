import type { Usage } from "@peons/schema";
export type SystemBlock = { text: string; cache: boolean };
export type ReviewInput = { system: SystemBlock[]; user: string; model: string; toolName: string; toolDescription: string; schema: Record<string, unknown> };
export type ReviewOutput = { raw: unknown; usage: Usage };
export interface Provider { review(input: ReviewInput): Promise<ReviewOutput>; }
