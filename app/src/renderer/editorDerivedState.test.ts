import { describe, expect, it } from "vitest";

import type { PaneState, Tab } from "./store/editorStore";
import {
  extractOutlineHeadings,
  getActiveFileTabInPane,
  getActiveTabInPane,
  outlineHeadingsMaxCount,
  updateOutlineSnapshot
} from "./editorDerivedState";
import {
  __getTextChangeRangeScannedCharactersForTests,
  __resetTextChangeRangeScannedCharactersForTests
} from "./textChangeRange";

describe("editorDerivedState", () => {
  it("指定ペインのアクティブタブを返す", () => {
    const leftPane: PaneState = { activeTabId: "left-tab", history: ["left-tab"], tabIds: ["left-tab"] };
    const rightPane: PaneState = { activeTabId: "right-tab", history: ["right-tab"], tabIds: ["right-tab"] };
    const tabs: Record<string, Tab> = {
      "left-tab": { content: "# Left", id: "left-tab", kind: "file", name: "Left", path: "left.md", savedContent: "# Left" },
      "right-tab": { content: "# Right", id: "right-tab", kind: "file", name: "Right", path: "right.md", savedContent: "# Right" }
    };

    expect(getActiveFileTabInPane("left", { leftPane, rightPane }, tabs)?.path).toBe("left.md");
    expect(getActiveFileTabInPane("right", { leftPane, rightPane }, tabs)?.path).toBe("right.md");
    expect(getActiveTabInPane("left", { leftPane, rightPane }, tabs)?.name).toBe("Left");
  });

  it("存在しないアクティブタブは null にする", () => {
    const leftPane: PaneState = { activeTabId: "missing", history: ["missing"], tabIds: ["missing"] };
    const rightPane: PaneState = { activeTabId: null, history: [], tabIds: [] };

    expect(getActiveTabInPane("left", { leftPane, rightPane }, {})).toBeNull();
    expect(getActiveTabInPane("right", { leftPane, rightPane }, {})).toBeNull();
  });

  it("Markdown見出しからアウトラインを抽出する", () => {
    const content = [
      "# Title",
      "本文",
      "### Detail",
      "####Deep without space",
      "###### Max"
    ].join("\n");

    expect(extractOutlineHeadings(content)).toEqual([
      { from: content.indexOf("# Title"), level: 1, text: "Title" },
      { from: content.indexOf("### Detail"), level: 3, text: "Detail" },
      { from: content.indexOf("###### Max"), level: 6, text: "Max" }
    ]);
  });

  it("見出しが多すぎるMarkdownではアウトライン抽出を上限で止める", () => {
    const lines = Array.from({ length: outlineHeadingsMaxCount + 10 }, (_, index) => `## Heading ${index + 1}`);
    const content = lines.join("\n");

    const headings = extractOutlineHeadings(content);

    expect(headings).toHaveLength(outlineHeadingsMaxCount);
    expect(headings.at(-1)).toEqual({
      from: content.indexOf(`## Heading ${outlineHeadingsMaxCount}`),
      level: 2,
      text: `Heading ${outlineHeadingsMaxCount}`
    });
  });

  it("変更行の見出しだけを置換し、後続見出しの位置を差分移動する", () => {
    const original = "# A\n本文\n## B\n末尾\n### C";
    const initial = updateOutlineSnapshot(null, original);
    const content = "# A\n長い本文です\n#### Changed\n末尾\n### C";
    const updated = updateOutlineSnapshot(initial, content);

    expect(updated.headings).toEqual(extractOutlineHeadings(content));
    expect(updated.headings.at(-1)?.from).toBe(content.lastIndexOf("### C"));
  });

  it("変更範囲の通知がある場合は長い前置き本文を比較走査しない", () => {
    const original = `${"本文\n".repeat(500)}## Before\n末尾`;
    const initial = updateOutlineSnapshot(null, original, 1);
    const from = original.indexOf("Before");
    const content = `${original.slice(0, from)}After${original.slice(from + "Before".length)}`;
    __resetTextChangeRangeScannedCharactersForTests();

    const updated = updateOutlineSnapshot(initial, content, 2, {
      change: { from, newTo: from + 5, oldTo: from + 6 },
      generation: 1,
      previousRevision: 1,
      revision: 2
    });

    expect(updated.headings.at(-1)?.text).toBe("After");
    expect(__getTextChangeRangeScannedCharactersForTests()).toBe(0);
  });
});
