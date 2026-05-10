import { afterEach, describe, expect, it } from "vitest";

import { defaultEditorSettings } from "../../shared/ipc";
import { useEditorStore } from "./editorStore";

const sampleFile = {
  content: "# テスト",
  name: "テスト",
  path: "テスト.md"
};

const sampleFile2 = {
  content: "# 別ファイル",
  name: "別ファイル",
  path: "別ファイル.md"
};

function resetStore(): void {
  useEditorStore.setState({
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: { activeTabId: null, history: [], tabIds: [] },
    rightPane: { activeTabId: null, history: [], tabIds: [] },
    tabs: {}
  });
}

describe("editorStore", () => {
  afterEach(resetStore);

  it("ファイルを左ペインで開くとタブが追加されアクティブになる", () => {
    const { openFileInPane, leftPane, tabs } = useEditorStore.getState();

    openFileInPane("left", sampleFile);

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toHaveLength(1);
    expect(state.leftPane.activeTabId).toBeTruthy();
    const tabId = state.leftPane.activeTabId!;
    expect(state.tabs[tabId].name).toBe("テスト");
    expect(state.tabs[tabId].kind).toBe("file");
    if (state.tabs[tabId].kind === "file") expect(state.tabs[tabId].path).toBe("テスト.md");

    void leftPane;
    void tabs;
  });

  it("同じパスのファイルを再度開くとタブが重複しない", () => {
    const { openFileInPane } = useEditorStore.getState();

    openFileInPane("left", sampleFile);
    openFileInPane("left", sampleFile);

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toHaveLength(1);
  });

  it("タブを閉じると履歴ベースで直前のタブがアクティブになる", () => {
    const { openFileInPane } = useEditorStore.getState();

    openFileInPane("left", sampleFile);
    openFileInPane("left", sampleFile2);

    const afterOpen = useEditorStore.getState();
    const [firstTabId] = afterOpen.leftPane.tabIds;
    const secondTabId = afterOpen.leftPane.activeTabId!;

    useEditorStore.getState().closeTab("left", secondTabId);

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toHaveLength(1);
    expect(state.leftPane.activeTabId).toBe(firstTabId);
    expect(state.tabs[secondTabId]).toBeUndefined();
  });

  it("最後のタブを閉じるとアクティブタブが null になる", () => {
    const { openFileInPane } = useEditorStore.getState();

    openFileInPane("left", sampleFile);

    const { leftPane } = useEditorStore.getState();
    const tabId = leftPane.activeTabId!;

    useEditorStore.getState().closeTab("left", tabId);

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toHaveLength(0);
    expect(state.leftPane.activeTabId).toBeNull();
  });

  it("タブの内容を更新できる", () => {
    const { openFileInPane } = useEditorStore.getState();

    openFileInPane("left", sampleFile);

    const { leftPane, updateTabContent } = useEditorStore.getState();
    const tabId = leftPane.activeTabId!;

    updateTabContent(tabId, "更新された内容");

    const state = useEditorStore.getState();

    expect(state.tabs[tabId].kind).toBe("file");
    if (state.tabs[tabId].kind === "file") expect(state.tabs[tabId].content).toBe("更新された内容");
  });

  it("分割表示をトグルできる", () => {
    expect(useEditorStore.getState().isSplit).toBe(false);

    useEditorStore.getState().toggleSplit();

    expect(useEditorStore.getState().isSplit).toBe(true);

    useEditorStore.getState().toggleSplit();

    expect(useEditorStore.getState().isSplit).toBe(false);
  });

  it("ファイルを開いた状態で分割すると右ペインにも同じタブが表示される", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().toggleSplit();

    const state = useEditorStore.getState();

    expect(state.isSplit).toBe(true);
    expect(state.leftPane.activeTabId).toBe(activeTabId);
    expect(state.rightPane.activeTabId).toBe(activeTabId);
    expect(state.rightPane.tabIds).toEqual([activeTabId]);
  });

  it("すでに開いているファイルを別ペインで開くと、そのペインのタブ列にも表示される", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().toggleSplit();
    useEditorStore.getState().openFileInPane("right", sampleFile);

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toContain(tabId);
    expect(state.rightPane.tabIds).toContain(tabId);
    expect(state.rightPane.activeTabId).toBe(tabId);
    expect(Object.values(state.tabs).filter((tab) => tab.kind === "file" && tab.path === sampleFile.path)).toHaveLength(1);
  });

  it("画面タブを開くと安定したIDでアクティブになる", () => {
    useEditorStore.getState().openPanelInPane("left", "settings", "設定");
    useEditorStore.getState().openPanelInPane("left", "settings", "設定");

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toEqual(["panel-settings"]);
    expect(state.leftPane.activeTabId).toBe("panel-settings");
    expect(state.tabs["panel-settings"]).toEqual({
      id: "panel-settings",
      kind: "panel",
      name: "設定",
      panel: "settings"
    });
  });

  it("分割解除時に右ペインのタブが閉じられる", () => {
    useEditorStore.getState().toggleSplit();
    useEditorStore.getState().openFileInPane("right", sampleFile2);

    expect(useEditorStore.getState().rightPane.tabIds).toHaveLength(1);

    useEditorStore.getState().toggleSplit();

    const state = useEditorStore.getState();

    expect(state.rightPane.tabIds).toHaveLength(0);
    expect(state.rightPane.activeTabId).toBeNull();
  });

  it("closeAllTabs で全タブが削除される", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);

    useEditorStore.getState().closeAllTabs();

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toHaveLength(0);
    expect(Object.keys(state.tabs)).toHaveLength(0);
  });
});
