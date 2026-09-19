export function isTTYMode(opts: { format?: string }, stream: { isTTY?: boolean } = process.stdout): boolean {
  return !opts.format && !!stream.isTTY && !process.env.CI;
}
