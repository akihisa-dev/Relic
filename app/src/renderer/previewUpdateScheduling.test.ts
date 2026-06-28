import { describe, expect, it } from "vitest";

import {
  hugePreviewUpdateDelayMs,
  largePreviewUpdateDelayMs,
  previewUpdateDelayMs
} from "./previewUpdateScheduling";

describe("previewUpdateScheduling", () => {
  it("小さいMarkdownは遅延せず、大きいMarkdownだけプレビュー更新を遅らせる", () => {
    expect(previewUpdateDelayMs("# title")).toBe(0);
    expect(previewUpdateDelayMs("x".repeat(20_000))).toBe(largePreviewUpdateDelayMs);
    expect(previewUpdateDelayMs("x".repeat(100_000))).toBe(hugePreviewUpdateDelayMs);
  });
});
