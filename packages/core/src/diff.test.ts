import { test, expect } from "bun:test";
import { parseUnifiedDiff } from "./diff.ts";

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1..2 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,4 @@
 line1
+added
 line2
 line3
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+x
+y
`;
test("parses hunks per new path", () => {
  const m = parseUnifiedDiff(DIFF);
  expect([...m.keys()]).toEqual(["src/a.ts", "src/new.ts"]);
  const h = m.get("src/a.ts")![0]!;
  expect(h).toMatchObject({ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4 });
  expect(h.text.startsWith("@@ -1,3 +1,4 @@")).toBe(true);
  expect(m.get("src/new.ts")![0]!.newLines).toBe(2);
});
