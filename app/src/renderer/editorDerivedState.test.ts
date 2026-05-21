import { describe, expect, it } from "vitest";

import type { PaneState, Tab } from "./store/editorStore";
import { extractOutlineHeadings, getActiveCardTabInPane, getActiveTabInPane } from "./editorDerivedState";

describe("editorDerivedState", () => {
  it("指定ペインのアクティブタブを返す", () => {
    const leftPane: PaneState = { activeTabId: "left-tab", history: ["left-tab"], tabIds: ["left-tab"] };
    const rightPane: PaneState = { activeTabId: "right-tab", history: ["right-tab"], tabIds: ["right-tab"] };
    const tabs: Record<string, Tab> = {
      "left-tab": { content: "# Left", id: "left-tab", kind: "card", name: "Left", path: "left.md" },
      "right-tab": { content: "# Right", id: "right-tab", kind: "card", name: "Right", path: "right.md" }
    };

    expect(getActiveCardTabInPane("left", { leftPane, rightPane }, tabs)?.path).toBe("left.md");
    expect(getActiveCardTabInPane("right", { leftPane, rightPane }, tabs)?.path).toBe("right.md");
    expect(getActiveTabInPane("left", { leftPane, rightPane }, tabs)?.name).toBe("Left");
  });

  it("存在しないアクティブタブは null にする", () => {
    const leftPane: PaneState = { activeTabId: "missing", history: ["missing"], tabIds: ["missing"] };
    const rightPane: PaneState = { activeTabId: null, history: [], tabIds: [] };

    expect(getActiveTabInPane("left", { leftPane, rightPane }, {})).toBeNull();
    expect(getActiveTabInPane("right", { leftPane, rightPane }, {})).toBeNull();
  });

  it("Markdown見出しからアウトラインを抽出する", () => {
    expect(extractOutlineHeadings([
      "# Title",
      "本文",
      "### Detail",
      "####Deep without space",
      "###### Max"
    ].join("\n"))).toEqual([
      { level: 1, text: "Title" },
      { level: 3, text: "Detail" },
      { level: 6, text: "Max" }
    ]);
  });
});
