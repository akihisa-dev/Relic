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

const sampleFile3 = {
  content: "# 第三",
  name: "第三",
  path: "第三.md"
};

function resetStore(): void {
  useEditorStore.setState({
    closedTabs: [],
    editorSettings: defaultEditorSettings,
    focusedPane: "left",
    isSplit: false,
    leftPane: { activeTabId: null, history: [], tabIds: [] },
    navigationHistory: [],
    navigationIndex: -1,
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
    if (state.tabs[tabId].kind === "file") {
      expect(state.tabs[tabId].path).toBe("テスト.md");
      expect(state.tabs[tabId].savedContent).toBe("# テスト");
    }

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

  it("同じパスの画像を再度開くと画像タブが重複しない", () => {
    const { openImageInPane } = useEditorStore.getState();

    openImageInPane("left", { name: "map.jpg", path: "assets/map.jpg" });
    openImageInPane("left", { name: "map.jpg", path: "assets/map.jpg" });

    const state = useEditorStore.getState();
    const tabId = state.leftPane.activeTabId!;

    expect(state.leftPane.tabIds).toHaveLength(1);
    expect(state.tabs[tabId]).toMatchObject({
      kind: "image",
      name: "map.jpg",
      path: "assets/map.jpg"
    });
  });

  it("同じパスのPDFを再度開くとPDFタブが重複しない", () => {
    const { openPdfInPane } = useEditorStore.getState();

    openPdfInPane("left", { name: "reference.pdf", path: "assets/reference.pdf" });
    openPdfInPane("left", { name: "reference.pdf", path: "assets/reference.pdf" });

    const state = useEditorStore.getState();
    const tabId = state.leftPane.activeTabId!;

    expect(state.leftPane.tabIds).toHaveLength(1);
    expect(state.tabs[tabId]).toMatchObject({
      kind: "pdf",
      name: "reference.pdf",
      path: "assets/reference.pdf"
    });
  });


  it("新しいファイルタブは現在のアクティブタブの右側に追加される", () => {
    const { openFileInPane, setTabActive } = useEditorStore.getState();

    openFileInPane("left", sampleFile);
    openFileInPane("left", sampleFile2);

    const firstTabId = useEditorStore.getState().leftPane.tabIds[0];
    const secondTabId = useEditorStore.getState().leftPane.tabIds[1];
    setTabActive("left", firstTabId);
    openFileInPane("left", sampleFile3);

    const state = useEditorStore.getState();
    const thirdTabId = state.leftPane.activeTabId!;

    expect(state.leftPane.tabIds).toEqual([firstTabId, thirdTabId, secondTabId]);
    expect(state.tabs[thirdTabId].kind).toBe("file");
    if (state.tabs[thirdTabId].kind === "file") {
      expect(state.tabs[thirdTabId].path).toBe(sampleFile3.path);
    }
  });

  it("画面タブとチャートタブも現在のアクティブタブの右側に追加される", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);

    const firstTabId = useEditorStore.getState().leftPane.tabIds[0];
    const secondTabId = useEditorStore.getState().leftPane.tabIds[1];
    useEditorStore.getState().setTabActive("left", firstTabId);
    useEditorStore.getState().openPanelInPane("left", "settings", "設定");
    useEditorStore.getState().setTabActive("left", firstTabId);
    useEditorStore.getState().openChartInPane("left", { id: "chronicle", name: "年表" });

    expect(useEditorStore.getState().leftPane.tabIds).toEqual([
      firstTabId,
      "chart-chronicle",
      "panel-settings",
      secondTabId
    ]);
  });

  it("開いたファイルの履歴を戻り、同じ履歴を進める", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const firstTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    const secondTabId = useEditorStore.getState().leftPane.activeTabId!;

    expect(useEditorStore.getState().navigationHistory.map((entry) => entry.tabId)).toEqual([
      firstTabId,
      secondTabId
    ]);

    useEditorStore.getState().navigateBack();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(firstTabId);
    expect(useEditorStore.getState().navigationIndex).toBe(0);

    useEditorStore.getState().navigateForward();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(secondTabId);
    expect(useEditorStore.getState().navigationIndex).toBe(1);
  });

  it("戻った後に別のタブを選ぶと進む履歴を破棄する", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const firstTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    const secondTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().openFileInPane("left", sampleFile3);

    useEditorStore.getState().navigateBack();
    useEditorStore.getState().setTabActive("left", firstTabId);
    const selectedState = useEditorStore.getState();

    expect(selectedState.navigationHistory.map((entry) => entry.tabId)).toEqual([
      firstTabId,
      secondTabId,
      firstTabId
    ]);
    expect(selectedState.navigationIndex).toBe(selectedState.navigationHistory.length - 1);

    useEditorStore.getState().navigateForward();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(firstTabId);
  });

  it("パネルタブも前後の閲覧履歴に含める", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const fileTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().openPanelInPane("left", "settings", "設定");

    useEditorStore.getState().navigateBack();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(fileTabId);

    useEditorStore.getState().navigateForward();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-settings");
  });

  it("分割ペインをまたいで履歴のタブとペインを復元する", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const leftTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().toggleSplit();
    useEditorStore.getState().openFileInPane("right", sampleFile2);
    const rightTabId = useEditorStore.getState().rightPane.activeTabId!;

    useEditorStore.getState().navigateBack();
    expect(useEditorStore.getState()).toMatchObject({
      focusedPane: "left",
      leftPane: { activeTabId: leftTabId }
    });

    useEditorStore.getState().navigateForward();
    expect(useEditorStore.getState()).toMatchObject({
      focusedPane: "right",
      rightPane: { activeTabId: rightTabId }
    });
  });

  it("閉じたタブを閲覧履歴から除外する", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const firstTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    const secondTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().setTabActive("left", firstTabId);

    useEditorStore.getState().closeTab("left", secondTabId);
    const state = useEditorStore.getState();

    expect(state.navigationHistory).toEqual([{ pane: "left", tabId: firstTabId }]);
    expect(state.navigationIndex).toBe(0);
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
    if (state.tabs[tabId].kind === "file") {
      expect(state.tabs[tabId].content).toBe("更新された内容");
      expect(state.tabs[tabId].savedContent).toBe("# テスト");
    }
  });

  it("保存成功扱いで保存基準を更新できる", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().updateTabContent(tabId, "更新された内容");
    useEditorStore.getState().markTabSaved(tabId, "更新された内容");

    const tab = useEditorStore.getState().tabs[tabId];

    expect(tab.kind).toBe("file");
    if (tab.kind === "file") {
      expect(tab.content).toBe("更新された内容");
      expect(tab.savedContent).toBe("更新された内容");
      expect(tab.externalConflict).toBeUndefined();
    }
  });

  it("外部変更の衝突を記録し外部版で解決できる", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().updateTabContent(tabId, "Relic側の編集中本文");
    useEditorStore.getState().setTabExternalConflict(tabId, "外部版");

    let tab = useEditorStore.getState().tabs[tabId];
    expect(tab.kind).toBe("file");
    if (tab.kind === "file") {
      expect(tab.content).toBe("Relic側の編集中本文");
      expect(tab.savedContent).toBe("# テスト");
      expect(tab.externalConflict?.content).toBe("外部版");
    }

    useEditorStore.getState().resolveTabExternalConflict(tabId, "external");
    tab = useEditorStore.getState().tabs[tabId];
    expect(tab.kind).toBe("file");
    if (tab.kind === "file") {
      expect(tab.content).toBe("外部版");
      expect(tab.savedContent).toBe("外部版");
      expect(tab.externalConflict).toBeUndefined();
    }
  });

  it("外部変更の衝突をRelic版保存成功として解決できる", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().updateTabContent(tabId, "Relic側の編集中本文");
    useEditorStore.getState().setTabExternalConflict(tabId, "外部版");
    useEditorStore.getState().resolveTabExternalConflict(tabId, "relic");

    const tab = useEditorStore.getState().tabs[tabId];

    expect(tab.kind).toBe("file");
    if (tab.kind === "file") {
      expect(tab.content).toBe("Relic側の編集中本文");
      expect(tab.savedContent).toBe("Relic側の編集中本文");
      expect(tab.externalConflict).toBeUndefined();
    }
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

  it("同じペイン内でタブを並べ替えられる", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);

    const stateBeforeMove = useEditorStore.getState();
    const [firstTabId, secondTabId] = stateBeforeMove.leftPane.tabIds;

    useEditorStore.getState().moveTab("left", "left", secondTabId, firstTabId, "before");

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toEqual([secondTabId, firstTabId]);
    expect(state.leftPane.activeTabId).toBe(secondTabId);
  });

  it("タブをピン留めすると左側に固定し、解除すると通常タブへ戻す", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);

    const [firstTabId, secondTabId] = useEditorStore.getState().leftPane.tabIds;

    useEditorStore.getState().toggleTabPinned(secondTabId);

    let state = useEditorStore.getState();
    expect(state.tabs[secondTabId].isPinned).toBe(true);
    expect(state.leftPane.tabIds).toEqual([secondTabId, firstTabId]);

    useEditorStore.getState().toggleTabPinned(secondTabId);

    state = useEditorStore.getState();
    expect(state.tabs[secondTabId].isPinned).toBe(false);
    expect(state.leftPane.tabIds).toEqual([secondTabId, firstTabId]);
  });

  it("ピン留めタブは単発close以外の一括closeに巻き込まれない", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    useEditorStore.getState().openFileInPane("left", sampleFile3);

    let state = useEditorStore.getState();
    const [firstTabId, secondTabId, thirdTabId] = state.leftPane.tabIds;
    useEditorStore.getState().toggleTabPinned(secondTabId);

    useEditorStore.getState().closeOtherTabs("left", thirdTabId);
    state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toEqual([secondTabId, thirdTabId]);
    expect(state.tabs[secondTabId]).toBeDefined();
    expect(state.tabs[firstTabId]).toBeUndefined();

    useEditorStore.getState().openFileInPane("left", sampleFile);
    state = useEditorStore.getState();
    const reopenedFirstTabId = state.leftPane.tabIds.find((id) => id !== secondTabId && id !== thirdTabId)!;

    useEditorStore.getState().closeTabsToRight("left", secondTabId);
    state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toEqual([secondTabId]);
    expect(state.tabs[reopenedFirstTabId]).toBeUndefined();
    expect(state.tabs[thirdTabId]).toBeUndefined();

    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().closeAllTabsInPane("left");
    state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toEqual([secondTabId]);
    expect(state.tabs[secondTabId]).toBeDefined();

    useEditorStore.getState().closeTab("left", secondTabId);
    state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toHaveLength(0);
    expect(state.tabs[secondTabId]).toBeUndefined();
  });

  it("分割表示中にタブを左右ペイン間で移動できる", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    useEditorStore.getState().toggleSplit();

    const stateBeforeMove = useEditorStore.getState();
    const movingTabId = stateBeforeMove.leftPane.tabIds[0];
    const targetTabId = stateBeforeMove.rightPane.tabIds[0];

    useEditorStore.getState().moveTab("left", "right", movingTabId, targetTabId, "after");

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).not.toContain(movingTabId);
    expect(state.rightPane.tabIds).toEqual([targetTabId, movingTabId]);
    expect(state.rightPane.activeTabId).toBe(movingTabId);
    expect(state.focusedPane).toBe("right");
  });

  it("closeAllTabs で全タブが削除される", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);

    useEditorStore.getState().closeAllTabs();

    const state = useEditorStore.getState();

    expect(state.leftPane.tabIds).toHaveLength(0);
    expect(Object.keys(state.tabs)).toHaveLength(0);
    expect(state.navigationHistory).toEqual([]);
    expect(state.navigationIndex).toBe(-1);
    expect(state.closedTabs).toEqual([]);
  });

  it("最後に閉じたタブを元の位置へ戻してアクティブにする", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    useEditorStore.getState().openFileInPane("left", sampleFile3);
    const closedTabId = useEditorStore.getState().leftPane.tabIds[1];

    useEditorStore.getState().closeTab("left", closedTabId);
    useEditorStore.getState().reopenClosedTab();

    const state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toEqual([
      expect.any(String),
      closedTabId,
      expect.any(String)
    ]);
    expect(state.leftPane.activeTabId).toBe(closedTabId);
    expect(state.focusedPane).toBe("left");
    expect(state.closedTabs).toEqual([]);
  });

  it("閉じたタブを新しい順に復元し、既に開いている同じファイルは重複させない", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const firstTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    const secondTabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().closeTab("left", firstTabId);
    useEditorStore.getState().closeTab("left", secondTabId);
    useEditorStore.getState().openFileInPane("left", sampleFile2);
    const manuallyOpenedTabId = useEditorStore.getState().leftPane.activeTabId!;
    useEditorStore.getState().reopenClosedTab();

    let state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toEqual([manuallyOpenedTabId]);
    expect(state.leftPane.activeTabId).toBe(manuallyOpenedTabId);

    useEditorStore.getState().reopenClosedTab();
    state = useEditorStore.getState();
    expect(state.tabs[state.leftPane.activeTabId!]).toMatchObject({ path: sampleFile.path });
    expect(state.leftPane.tabIds).toHaveLength(2);
  });

  it("右ペインを閉じた後は閉じたタブを左ペインへ復元する", () => {
    useEditorStore.getState().toggleSplit();
    useEditorStore.getState().openFileInPane("right", sampleFile);
    const tabId = useEditorStore.getState().rightPane.activeTabId!;
    useEditorStore.getState().closeTab("right", tabId);
    useEditorStore.getState().toggleSplit();

    useEditorStore.getState().reopenClosedTab();

    const state = useEditorStore.getState();
    expect(state.isSplit).toBe(false);
    expect(state.leftPane.tabIds).toContain(tabId);
    expect(state.leftPane.activeTabId).toBe(tabId);
  });

  it("削除や外部変更として閉じたタブは復元履歴へ追加しない", () => {
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const tabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().closeTab("left", tabId);
    useEditorStore.getState().openFileInPane("left", sampleFile);
    const reopenedTabId = useEditorStore.getState().leftPane.activeTabId!;

    useEditorStore.getState().closeTab("left", reopenedTabId, false);
    useEditorStore.getState().reopenClosedTab();

    const state = useEditorStore.getState();
    expect(state.leftPane.tabIds).toEqual([]);
    expect(state.closedTabs).toEqual([]);
  });
});
