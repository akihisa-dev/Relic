import { describe, expect, it } from "vitest";

import {
  __getEditorTabIndexBuildCountForTests,
  __resetEditorTabIndexBuildCountForTests,
  editorTabIndex,
  transferEditorTabContentIndex
} from "./editorTabIndexes";
import type { FileTab, Tab } from "./store/editorStore";

describe("editorTabIndexes", () => {
  it("本文更新後も全タブ索引を再構築しない", () => {
    __resetEditorTabIndexBuildCountForTests();
    const tab: FileTab = {
      content: "before",
      id: "target",
      kind: "file",
      name: "Target",
      path: "target.md",
      savedContent: "before"
    };
    const tabs: Record<string, Tab> = {
      target: tab,
      other: { content: "other", id: "other", kind: "file", name: "Other", path: "other.md", savedContent: "other" }
    };
    editorTabIndex(tabs);
    const updatedTab = { ...tab, content: "after" };
    const updatedTabs = { ...tabs, target: updatedTab };
    transferEditorTabContentIndex(tabs, updatedTabs, tab, updatedTab);

    expect(editorTabIndex(updatedTabs).dirtyMarkdownPaths).toEqual(["target.md"]);
    expect(__getEditorTabIndexBuildCountForTests()).toBe(1);
  });
});
