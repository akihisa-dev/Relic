import { describe, expect, it } from "vitest";

import type { PaneState, Tab } from "../store/editorStore";
import { createTranslator } from "../i18n";
import {
  deleteTreeItemMessage,
  getActiveCardTab,
  movedCardFolderPath,
  renamedCardFolderPath,
  tabCloseTargetsForTreeItem,
  tabCloseTargetsForTreeItems
} from "./cardbookCardMutationModel";

const leftPane: PaneState = { activeTabId: "tab-a", history: ["tab-a"], tabIds: ["tab-a", "tab-b"] };
const rightPane: PaneState = { activeTabId: "tab-c", history: ["tab-c"], tabIds: ["tab-c"] };
const tabs: Record<string, Tab> = {
  "tab-a": { content: "", id: "tab-a", kind: "card", name: "A", path: "docs/A.md" },
  "tab-b": { content: "", id: "tab-b", kind: "card", name: "B", path: "docs/nested/B.md" },
  "tab-c": { id: "tab-c", kind: "panel", name: "設定", panel: "settings" }
};
const t = createTranslator("ja");

describe("cardbookCardMutationModel", () => {
  it("active card tabだけを取り出す", () => {
    expect(getActiveCardTab({ focusedPane: "left", leftPane, rightPane, tabs })).toEqual({
      tab: tabs["tab-a"],
      tabId: "tab-a"
    });
    expect(getActiveCardTab({ focusedPane: "right", leftPane, rightPane, tabs })).toBeNull();
  });

  it("移動・rename後のcardFolder pathを既存形式で作る", () => {
    expect(movedCardFolderPath("docs/nested", "archive")).toBe("archive/nested");
    expect(renamedCardFolderPath("docs/nested", "renamed")).toBe("docs/renamed");
  });

  it("削除確認文言を既存文言で作る", () => {
    expect(deleteTreeItemMessage("docs", "cardFolder", t)).toContain("カードフォルダをゴミ箱に移動しますか？");
    expect(deleteTreeItemMessage("docs/A.md", "card", t)).toBe("「A」をゴミ箱に移動しますか？");
  });

  it("削除対象に含まれるcard tab close対象を左右ペイン別に返す", () => {
    expect(tabCloseTargetsForTreeItem({
      item: { path: "docs", type: "cardFolder" },
      leftPane,
      rightPane,
      tabs
    })).toEqual([
      { pane: "left", tabId: "tab-a" },
      { pane: "left", tabId: "tab-b" }
    ]);

    expect(tabCloseTargetsForTreeItems({
      items: [{ path: "docs/nested", type: "cardFolder" }],
      leftPane,
      rightPane,
      tabs
    })).toEqual([{ pane: "left", tabId: "tab-b" }]);
  });
});
