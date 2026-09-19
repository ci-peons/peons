export class EngineError extends Error {
  readonly exit = 2 as const;
  readonly status?: number;
  constructor(public code: string, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "EngineError";
    this.status = options?.status;
  }
}
