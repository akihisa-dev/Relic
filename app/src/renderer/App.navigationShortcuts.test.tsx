import {
  act,
  fireEvent,
  screen,
  within,
  waitFor
} from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { defaultEditorSettings } from "../shared/ipc";
import {
  allRailFeatureToggles,
  renderApp,
  restoreNavigatorPlatform,
  setNavigatorPlatform
} from "./appTestHelpers";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

describe("App navigation and shortcuts", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("画面タブ名は言語変更に追従する", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const rail = container.querySelector(".rail");
    if (!(rail instanceof HTMLElement)) throw new Error("rail was not rendered");
    fireEvent.click(within(rail).getByRole("button", { name: "設定" }));

    expect(document.querySelector('.pane-tab[data-tab-id="panel-settings"]')?.textContent).toContain("設定");

    useEditorStore.getState().setEditorSettings({ ...defaultEditorSettings, language: "en" });

    await waitFor(() => {
      expect(document.querySelector('.pane-tab[data-tab-id="panel-settings"]')?.textContent).toContain("Settings");
    });
  });

  it("別の画面タブを開いた後でも開いているレールボタンを押すと対象タブをアクティブにする", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const rail = container.querySelector(".rail");
    if (!(rail instanceof HTMLElement)) throw new Error("rail was not rendered");
    const tableButton = within(rail).getByRole("button", { name: "テーブル" });

    fireEvent.click(tableButton);
    fireEvent.click(within(rail).getByRole("button", { name: "設定" }));

    expect(useEditorStore.getState().tabs["chart-table"]).toMatchObject({
      chartId: "table",
      kind: "chart"
    });
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-settings");
    expect(tableButton).toHaveClass("open");
    expect(tableButton).not.toHaveClass("active");

    fireEvent.click(tableButton);

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("chart-table");
    expect(tableButton).toHaveClass("active");
    expect(useEditorStore.getState().tabs["chart-table"]).toBeDefined();
    expect(useEditorStore.getState().tabs["panel-settings"]).toBeDefined();
  });

  it("分割表示を閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    const splitButton = await screen.findByRole("button", { name: "分割" });

    fireEvent.click(splitButton);
    const panes = container.querySelector(".panes-container");
    if (!(panes instanceof HTMLElement)) throw new Error("panes container was not rendered");
    expect(panes).toHaveClass("panes-container--split");

    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    expect(panes).toHaveClass("panes-container--closing-split");
  });

  it("ファイルタイトル行右側でソースモードを切り替えられる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "# 本文", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    const { container } = await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await screen.findByText("読書メモ", { selector: ".pane-tab-name" });

    const sourceButton = await screen.findByRole("button", { name: "ソース" });
    expect(screen.getByRole("button", { name: "分割" })).toBeInTheDocument();
    expect(container.querySelector(".title-bar .main-area-actions .toolbar-btn[aria-label=\"ソース\"]")).toBeNull();
    expect(container.querySelector(".editor-file-title-actions .toolbar-btn[aria-label=\"ソース\"]")).toBeInTheDocument();

    fireEvent.click(sourceButton);

    expect(sourceButton).toHaveClass("active");
  });

  it("分割表示では左右ペインのソースモードを独立して切り替える", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "左メモ", path: "左メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "# 左本文", name: "左メモ", path: "左メモ.md" }
      })
    });

    const { container } = await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /左メモ/ }));
    await screen.findByText("左メモ", { selector: ".pane-tab-name" });

    fireEvent.click(screen.getByRole("button", { name: "分割" }));
    act(() => {
      useEditorStore.getState().openFileInPane("right", {
        content: "# 右本文",
        name: "右メモ",
        path: "右メモ.md"
      });
    });

    await screen.findByText("右メモ", { selector: ".pane-tab-name" });

    const panes = container.querySelectorAll(".pane");
    expect(panes).toHaveLength(2);

    const leftSourceButton = within(panes[0] as HTMLElement).getByRole("button", { name: "ソース" });
    const rightSourceButton = within(panes[1] as HTMLElement).getByRole("button", { name: "ソース" });

    fireEvent.click(leftSourceButton);

    expect(leftSourceButton).toHaveClass("active");
    expect(rightSourceButton).not.toHaveClass("active");

    fireEvent.click(rightSourceButton);

    expect(leftSourceButton).toHaveClass("active");
    expect(rightSourceButton).toHaveClass("active");
  });

  it("ソースモードを切り替えてもエディタのカーソルとスクロール位置を維持する", async () => {
    const content = [
      "# 読書メモ",
      "",
      "**重要** な本文",
      "",
      ...Array.from({ length: 80 }, (_, index) => `行${index + 1}`)
    ].join("\n");

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content, name: "読書メモ", path: "読書メモ.md" }
      })
    });

    const { container } = await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await screen.findByText("読書メモ", { selector: ".pane-tab-name" });

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();

    const view = EditorView.findFromDOM(editorContent as HTMLElement);
    expect(view).not.toBeNull();

    const selection = {
      anchor: content.indexOf("重要"),
      head: content.indexOf(" な本文")
    };
    view!.scrollDOM.scrollTop = 144;
    view!.scrollDOM.scrollLeft = 11;
    view!.dispatch({ selection });

    const sourceButton = await screen.findByRole("button", { name: "ソース" });
    fireEvent.click(sourceButton);

    await waitFor(() => expect(sourceButton).toHaveClass("active"));
    expect(EditorView.findFromDOM(container.querySelector(".cm-content") as HTMLElement)).toBe(view);
    expect(view!.state.selection.main.from).toBe(selection.anchor);
    expect(view!.state.selection.main.to).toBe(selection.head);
    expect(view!.scrollDOM.scrollTop).toBe(144);
    expect(view!.scrollDOM.scrollLeft).toBe(11);

    fireEvent.click(sourceButton);

    await waitFor(() => expect(sourceButton).not.toHaveClass("active"));
    expect(EditorView.findFromDOM(container.querySelector(".cm-content") as HTMLElement)).toBe(view);
    expect(view!.state.selection.main.from).toBe(selection.anchor);
    expect(view!.state.selection.main.to).toBe(selection.head);
    expect(view!.scrollDOM.scrollTop).toBe(144);
    expect(view!.scrollDOM.scrollLeft).toBe(11);
  });

  it("サイドバーが閉じていても新規ファイルショートカットで対象ビューを開ける", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });
    useUiStore.setState({
      activeSidebarView: "files",
      isRightPanelOpen: true,
      isSidebarOpen: false,
      isTypewriterMode: false,
      rightPanelView: "outline"
    });

    await renderApp();

    await screen.findByRole("main");

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("files");
  });

  it("WindowsではCtrlキーで主要ショートカットを実行できる", async () => {
    setNavigatorPlatform("Win32");
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });
    useUiStore.setState({
      activeSidebarView: "files",
      isSidebarOpen: false
    });

    await renderApp();

    await screen.findByRole("main");

    fireEvent.keyDown(window, { key: "f", ctrlKey: true });

    expect(await screen.findByPlaceholderText("ファイル名を検索...")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "P", ctrlKey: true, shiftKey: true });

    expect(await screen.findByPlaceholderText("コマンドを検索...")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+P")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+N")).toBeInTheDocument();
  });

  it("閉じたタブがある場合はコマンドとショートカットで最後のタブを開ける", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();
    await screen.findByRole("main");

    act(() => {
      useEditorStore.getState().openPanelInPane("left", "settings", "設定");
      useEditorStore.getState().closeTab("left", "panel-settings");
    });

    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    expect(await screen.findByText("閉じたタブを開く")).toBeInTheDocument();
    expect(screen.getByText("⌘⇧T")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "t", metaKey: true, shiftKey: true });

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-settings");
    });
    expect(useEditorStore.getState().closedTabs).toEqual([]);
  });

  it("ファイルボタンでファイルサイドバーを開閉できる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    const fileButton = await screen.findByRole("button", { name: "ファイル" });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(fileButton).toHaveClass("active");

    fireEvent.click(fileButton);

    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    expect(fileButton).not.toHaveClass("active");

    fireEvent.click(fileButton);

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("files");
    expect(fileButton).toHaveClass("active");
  });
});
