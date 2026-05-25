import { describe, expect, it } from "vitest";

import type { PaneState, Tab } from "../store/editorStore";
import { createTranslator } from "../i18n";
import {
  deleteTreeItemMessage,
  getActiveFileTab,
  movedFolderPath,
  renamedFolderPath,
  tabCloseTargetsForTreeItem,
  tabCloseTargetsForTreeItems
} from "./workspaceFileMutationModel";

const leftPane: PaneState = { activeTabId: "tab-a", history: ["tab-a"], tabIds: ["tab-a", "tab-b"] };
const rightPane: PaneState = { activeTabId: "tab-c", history: ["tab-c"], tabIds: ["tab-c"] };
const tabs: Record<string, Tab> = {
  "tab-a": { content: "", id: "tab-a", kind: "file", name: "A", path: "docs/A.md", savedContent: "" },
  "tab-b": { content: "", id: "tab-b", kind: "file", name: "B", path: "docs/nested/B.md", savedContent: "" },
  "tab-c": { id: "tab-c", kind: "panel", name: "設定", panel: "settings" }
};
const t = createTranslator("ja");

describe("workspaceFileMutationModel", () => {
  it("active file tabだけを取り出す", () => {
    expect(getActiveFileTab({ focusedPane: "left", leftPane, rightPane, tabs })).toEqual({
      tab: tabs["tab-a"],
      tabId: "tab-a"
    });
    expect(getActiveFileTab({ focusedPane: "right", leftPane, rightPane, tabs })).toBeNull();
  });

  it("移動・rename後のfolder pathを既存形式で作る", () => {
    expect(movedFolderPath("docs/nested", "archive")).toBe("archive/nested");
    expect(renamedFolderPath("docs/nested", "renamed")).toBe("docs/renamed");
  });

  it("削除確認文言を既存文言で作る", () => {
    expect(deleteTreeItemMessage("docs", "folder", t)).toContain("フォルダをゴミ箱に移動しますか？");
    expect(deleteTreeItemMessage("docs/A.md", "file", t)).toBe("「A」をゴミ箱に移動しますか？");
  });

  it("削除対象に含まれるfile tab close対象を左右ペイン別に返す", () => {
    expect(tabCloseTargetsForTreeItem({
      item: { path: "docs", type: "folder" },
      leftPane,
      rightPane,
      tabs
    })).toEqual([
      { pane: "left", tabId: "tab-a" },
      { pane: "left", tabId: "tab-b" }
    ]);

    expect(tabCloseTargetsForTreeItems({
      items: [{ path: "docs/nested", type: "folder" }],
      leftPane,
      rightPane,
      tabs
    })).toEqual([{ pane: "left", tabId: "tab-b" }]);
  });
});
