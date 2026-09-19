export class EngineError extends Error {
  readonly exit = 2 as const;
  constructor(public code: string, message: string) { super(message); this.name = "EngineError"; }
}
