import { describe, expect, it } from "vitest";

import {
  collectMarkdownCodeRanges,
  decodeMarkdownPath,
  isMarkdownOffsetInRanges,
  normalizeMarkdownPathSegments
} from "./markdownScan";

describe("markdownScan", () => {
  it("フェンス、インデント、インラインコードの範囲を同じ規則で収集する", () => {
    const markdown = [
      "通常 [[link]]",
      "`[[inline]]`",
      "    [[indented]]",
      "~~~md",
      "[[fenced]]",
      "~~~"
    ].join("\n");
    const ranges = collectMarkdownCodeRanges(markdown);

    expect(isMarkdownOffsetInRanges(markdown.indexOf("[[link]]"), ranges)).toBe(false);
    expect(isMarkdownOffsetInRanges(markdown.indexOf("[[inline]]"), ranges)).toBe(true);
    expect(isMarkdownOffsetInRanges(markdown.indexOf("[[indented]]"), ranges)).toBe(true);
    expect(isMarkdownOffsetInRanges(markdown.indexOf("[[fenced]]"), ranges)).toBe(true);
  });

  it("Markdownパスのデコードと相対区間の正規化を共有する", () => {
    expect(decodeMarkdownPath("folder%20name\\note.md")).toBe("folder name/note.md");
    expect(normalizeMarkdownPathSegments("notes/./draft/../note.md")).toBe("notes/note.md");
  });

  it("閉じフェンスに説明が続く行ではコード範囲を終了しない", () => {
    const markdown = "~~~\ninside\n~~~ not-close\nstill-inside\n~~~\noutside";
    const ranges = collectMarkdownCodeRanges(markdown);

    expect(isMarkdownOffsetInRanges(markdown.indexOf("still-inside"), ranges)).toBe(true);
    expect(isMarkdownOffsetInRanges(markdown.indexOf("outside"), ranges)).toBe(false);
  });
});
