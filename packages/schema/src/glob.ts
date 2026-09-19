import picomatch from "picomatch";

/** True when every path matched by `ctx` would also be matched by some glob in `perms`.
 *  Decidable cases: verbatim equality; or a permission glob whose static prefix is a prefix of
 *  the context glob's static prefix and whose remainder is `**` (matches anything below). */
export function isCoveredBy(ctx: string, perms: string[]): boolean {
  for (const p of perms) {
    if (p === ctx || p === "**" || p === "**/*") return true;
    const scan = picomatch.scan(p);
    if (!scan.isGlob) continue;
    const rest = p.slice(scan.base.length).replace(/^\//, "");
    if (rest === "**" && scan.base.length > 0 && (ctx === scan.base || ctx.startsWith(scan.base + "/"))) return true;
  }
  return false;
}
