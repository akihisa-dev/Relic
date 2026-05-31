import {
  fireEvent,
  screen,
  waitFor
} from "@testing-library/react";
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

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "フロントマター" }));

    expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"]')?.textContent).toContain("フロントマター");

    useEditorStore.getState().setEditorSettings({ ...defaultEditorSettings, language: "en" });

    await waitFor(() => {
      expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"]')?.textContent).toContain("Frontmatter");
    });
  });

  it("別の画面タブを開いた後でも開いているレールボタンを押すと対象タブをアクティブにする", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: allRailFeatureToggles }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "フロントマター" }));
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toMatchObject({
      kind: "panel",
      panel: "frontmatter"
    });
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-settings");
    expect(screen.getByRole("button", { name: "フロントマター" })).toHaveClass("open");
    expect(screen.getByRole("button", { name: "フロントマター" })).not.toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "フロントマター" }));

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-frontmatter");
    expect(screen.getByRole("button", { name: "フロントマター" })).toHaveClass("active");
    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toBeDefined();
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

  it("右上の分割ボタン横でソースモードを切り替えられる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    const sourceButton = await screen.findByRole("button", { name: "ソース" });
    expect(screen.getByRole("button", { name: "分割" })).toBeInTheDocument();

    fireEvent.click(sourceButton);

    expect(sourceButton).toHaveClass("active");
  });

  it("サイドバーが閉じていてもショートカットで対象ビューを開ける", async () => {
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

    fireEvent.keyDown(window, { key: "f", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("files");
    await waitFor(() => {
      expect(screen.getByLabelText("ファイル検索")).toHaveFocus();
    });

    fireEvent.keyDown(window, { key: "b", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(false);

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

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    await waitFor(() => {
      expect(screen.getByLabelText("ファイル検索")).toHaveFocus();
    });

    fireEvent.keyDown(window, { key: "P", ctrlKey: true, shiftKey: true });

    expect(await screen.findByPlaceholderText("コマンドを検索...")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+P")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+N")).toBeInTheDocument();
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
