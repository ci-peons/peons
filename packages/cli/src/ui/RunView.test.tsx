import { test, expect } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { RunView } from "./RunView.tsx";

test("renders peon rows and findings", () => {
  const { lastFrame, unmount } = render(<RunView rows={[{ name: "a11y", version: "1.0.0", files: 2, status: "running", startedAt: Date.now(), findings: 0 }]} result={null} />);
  expect(lastFrame()).toContain("a11y@1.0.0");
  unmount();
});
