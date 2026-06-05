import { describe, expect, it } from "vitest";

import type { PaneState, Tab } from "./store/editorStore";
import {
  extractOutlineHeadings,
  getActiveFileTabInPane,
  getActiveTabInPane,
  outlineHeadingsMaxCount
} from "./editorDerivedState";

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
});
