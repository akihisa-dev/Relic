import { describe, expect, it } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import {
  closeTabState,
  emptyPane,
  moveTabState,
  openCardTabState,
  toggleSplitState,
  type EditorStoreModelState
} from "./editorStoreModel";

const sampleCard = {
  content: "# テスト",
  name: "テスト",
  path: "テスト.md"
};

function baseState(): EditorStoreModelState {
  return {
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: emptyPane(),
    rightPane: emptyPane(),
    tabs: {}
  };
}

function applyState(
  state: EditorStoreModelState,
  patch: Partial<EditorStoreModelState> | EditorStoreModelState
): EditorStoreModelState {
  return { ...state, ...patch };
}

describe("editorStoreModel", () => {
  it("同じカードpathのタブは新規作成せず対象ペインへ追加する", () => {
    const opened = applyState(baseState(), openCardTabState(baseState(), "left", sampleCard, "tab-a"));
    const reopened = applyState(opened, openCardTabState(opened, "right", sampleCard, "tab-b"));

    expect(Object.keys(reopened.tabs)).toEqual(["tab-a"]);
    expect(reopened.rightPane.tabIds).toEqual(["tab-a"]);
    expect(reopened.rightPane.activeTabId).toBe("tab-a");
  });

  it("片方のペインで閉じた共有タブはtabsから削除しない", () => {
    const state = applyState(baseState(), openCardTabState(baseState(), "left", sampleCard, "tab-a"));
    const sharedState: EditorStoreModelState = {
      ...state,
      rightPane: { activeTabId: "tab-a", history: ["tab-a"], tabIds: ["tab-a"] }
    };

    const next = applyState(sharedState, closeTabState(sharedState, "left", "tab-a"));

    expect(next.leftPane.tabIds).toEqual([]);
    expect(next.tabs["tab-a"]).toBeDefined();
    expect(next.rightPane.tabIds).toEqual(["tab-a"]);
  });

  it("存在しないタブの移動はno-opにする", () => {
    const state = baseState();

    expect(moveTabState(state, "left", "right", "missing")).toBe(state);
  });

  it("分割解除時は右ペインだけのタブを左ペインへ統合する", () => {
    const state: EditorStoreModelState = {
      ...baseState(),
      isSplit: true,
      leftPane: { activeTabId: "tab-a", history: ["tab-a"], tabIds: ["tab-a"] },
      rightPane: { activeTabId: "tab-b", history: ["tab-b"], tabIds: ["tab-b"] },
      tabs: {
        "tab-a": { content: "a", id: "tab-a", kind: "card", name: "A", path: "A.md" },
        "tab-b": { content: "b", id: "tab-b", kind: "card", name: "B", path: "B.md" }
      }
    };

    const next = applyState(state, toggleSplitState(state));

    expect(next.isSplit).toBe(false);
    expect(next.leftPane.tabIds).toEqual(["tab-a", "tab-b"]);
    expect(next.leftPane.activeTabId).toBe("tab-b");
    expect(next.rightPane.tabIds).toEqual([]);
  });
});
