import {
  fireEvent,
  screen,
  waitFor,
  within
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
import {
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

describe("App sidebar panels", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("ファイルツリーのフォルダを開閉できる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "読書メモ", path: "資料/読書メモ.md", type: "file" }],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ]
        }
      })
    });

    await renderApp();

    const folderButton = await screen.findByRole("button", { name: /資料/ });
    expect(screen.getByRole("button", { name: /読書メモ/ })).toBeInTheDocument();

    fireEvent.click(folderButton);

    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();

    fireEvent.click(folderButton);

    expect(screen.getByRole("button", { name: /読書メモ/ })).toBeInTheDocument();
  });

  it("左サイドバーを閉じているときも分割タブは行番号込みのエディタ左端を基準にする", async () => {
    useUiStore.setState({ isSidebarOpen: false });
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    expect(container.querySelector(".title-bar")).toHaveStyle({
      "--title-bar-editor-left-offset": "56px",
      "--title-bar-left-offset": "88px"
    });
  });

  it("フォルダ右クリックメニューからフォルダ以下と全体を一括開閉できる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [
                {
                  children: [{ name: "草稿", path: "資料/下書き/草稿.md", type: "file" }],
                  name: "下書き",
                  path: "資料/下書き",
                  type: "folder"
                },
                { name: "読書メモ", path: "資料/読書メモ.md", type: "file" }
              ],
              name: "資料",
              path: "資料",
              type: "folder"
            },
            {
              children: [{ name: "保管メモ", path: "保管/保管メモ.md", type: "file" }],
              name: "保管",
              path: "保管",
              type: "folder"
            }
          ]
        }
      })
    });

    await renderApp();

    const folderButton = await screen.findByRole("button", { name: /資料/ });

    fireEvent.contextMenu(folderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "このフォルダ以下を閉じる" }));
    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保管メモ/ })).toBeInTheDocument();

    fireEvent.contextMenu(folderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "このフォルダ以下を開く" }));
    expect(screen.getByRole("button", { name: /草稿/ })).toBeInTheDocument();

    fireEvent.contextMenu(folderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "すべてのフォルダを閉じる" }));
    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /保管メモ/ })).not.toBeInTheDocument();

    fireEvent.contextMenu(folderButton);
    fireEvent.click(await screen.findByRole("menuitem", { name: "すべてのフォルダを開く" }));
    expect(screen.getByRole("button", { name: /草稿/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保管メモ/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "すべてのフォルダを閉じる" }));
    expect(screen.queryByRole("button", { name: /読書メモ/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /保管メモ/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "すべてのフォルダを開く" }));
    expect(screen.getByRole("button", { name: /草稿/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保管メモ/ })).toBeInTheDocument();
  });

  it("開いているファイルをファイルツリーではハイライトしない", async () => {
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
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    const fileButton = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.click(fileButton);

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });
    expect(fileButton).not.toHaveClass("active");
    expect(fileButton).toHaveClass("open");
  });

  it("サイドバー幅のドラッグ変更を最小180px・最大500pxに制限する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    const sidebar = container.querySelector(".sidebar");
    const resizeHandle = container.querySelector(".sidebar-resize-handle");

    expect(sidebar).toBeInstanceOf(HTMLElement);
    expect(resizeHandle).toBeInstanceOf(HTMLElement);

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 260 });

    expect(sidebar).toHaveClass("sidebar--resizing");
    expect(resizeHandle).toHaveClass("sidebar-resize-handle--active");

    fireEvent.mouseMove(document, { clientX: 800 });

    expect(sidebar).toHaveStyle({ width: "500px" });

    fireEvent.mouseUp(document);

    expect(sidebar).not.toHaveClass("sidebar--resizing");
    expect(resizeHandle).not.toHaveClass("sidebar-resize-handle--active");

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: -200 });

    expect(sidebar).toHaveStyle({ width: "180px" });

    fireEvent.mouseUp(document);
  });

  it("AIチャットパネル幅のドラッグ変更を最小320px・最大520pxに制限する", async () => {
    const saveAppUiSettings = vi.fn().mockResolvedValue({ ok: true, value: { coworkPanelWidth: 520 } });
    window.relic = makeRelicApi({
      getAppUiSettings: vi.fn().mockResolvedValue({ ok: true, value: { coworkPanelWidth: 480 } }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      saveAppUiSettings
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Cowork" }));

    const secondarySidebar = container.querySelector(".secondary-sidebar");
    const resizeHandle = container.querySelector(".secondary-sidebar-resize-handle");

    expect(secondarySidebar).toBeInstanceOf(HTMLElement);
    expect(resizeHandle).toBeInstanceOf(HTMLElement);
    await waitFor(() => expect(secondarySidebar).toHaveStyle({ width: "480px" }));

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 480 });

    expect(secondarySidebar).toHaveClass("secondary-sidebar--resizing");
    expect(resizeHandle).toHaveClass("secondary-sidebar-resize-handle--active");

    fireEvent.mouseMove(document, { clientX: 900 });

    expect(secondarySidebar).toHaveStyle({ width: "520px" });

    fireEvent.mouseUp(document);
    expect(saveAppUiSettings).toHaveBeenLastCalledWith({ coworkPanelWidth: 520 });

    expect(secondarySidebar).not.toHaveClass("secondary-sidebar--resizing");
    expect(resizeHandle).not.toHaveClass("secondary-sidebar-resize-handle--active");

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 520 });
    fireEvent.mouseMove(document, { clientX: -200 });

    expect(secondarySidebar).toHaveStyle({ width: "320px" });

    fireEvent.mouseUp(document);
    expect(saveAppUiSettings).toHaveBeenLastCalledWith({ coworkPanelWidth: 320 });
  });

  it("右パネルのアウトライン・リンクボタンを閉じた後も再度開ける", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
    expect(container.querySelector(".title-bar--right-panel-open .main-area-actions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
    expect(container.querySelector(".title-bar--right-panel-open .main-area-actions")).toBeInTheDocument();

    const mainActions = document.querySelector(".main-area-actions");
    expect(mainActions).toBeInstanceOf(HTMLElement);
    expect(within(mainActions as HTMLElement).queryByRole("button", { name: "フロントマター" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("links");

    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("links");

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
  });
});
