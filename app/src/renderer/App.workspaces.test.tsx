import { readFileSync } from "node:fs";

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

describe("App workspaces", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("開いているワークスペースの切り替え操作をサイドバー下部の青い領域として表示する", () => {
    const css = readFileSync("src/renderer/styles/file-tree-search.css", "utf8");

    expect(css).toMatch(/\.sidebar-section:has\(> \.workspace-actions\)\s*\{[^}]*min-height:\s*100%;/s);
    expect(css).toMatch(/\.sidebar:has\(\.workspace-actions\)::after\s*\{[^}]*display:\s*none;/s);
    expect(css).toMatch(/\.workspace-actions\s*\{[^}]*background:\s*var\(--color-primary-dark\);/s);
    expect(css).not.toMatch(/\.workspace-actions\s*\{[^}]*position:\s*sticky;/s);
    expect(css).toMatch(/\.workspace-actions\s*\{[^}]*margin:\s*0 -16px;/s);
    expect(css).toMatch(/\.workspace-actions\s*\{[^}]*padding:\s*6px 24px 8px;/s);
    expect(css).not.toMatch(/\.workspace-actions\s*\{[^}]*min-height:/s);
    expect(css).toMatch(/\.workspace-actions \.workspace-action-button\s*\{[^}]*color:\s*color-mix\(in srgb, #fff 88%, var\(--color-primary-dark\) 12%\);/s);
    expect(css).toMatch(/\.workspace-actions \.workspace-action-button\s*\{[^}]*min-height:\s*28px;/s);
  });

  it("ファイル検索と作成操作は一覧スクロールから外して固定する", () => {
    const css = readFileSync("src/renderer/styles/file-tree-search.css", "utf8");

    expect(css).toMatch(/\.sidebar-body:has\(> \.files-sidebar-section\)\s*\{[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.files-sidebar-section\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/s);
    expect(css).toMatch(/\.files-sidebar-section\s*\{[^}]*height:\s*calc\(100% \+ 32px\);/s);
    expect(css).toMatch(/\.files-sidebar-section\s*\{[^}]*margin:\s*-16px;/s);
    expect(css).toMatch(/\.files-sidebar-section\s*\{[^}]*padding:\s*16px 16px 0;/s);
    expect(css).toMatch(/\.files-sidebar-fixed-controls\s*\{[^}]*position:\s*relative;/s);
    expect(css).toMatch(/\.files-sidebar-fixed-controls\s*\{[^}]*z-index:\s*6;/s);
    expect(css).toMatch(/\.files-sidebar-scroll-area\s*\{[^}]*min-height:\s*0;/s);
    expect(css).toMatch(/\.files-sidebar-scroll-area\s*\{[^}]*overflow-y:\s*auto;/s);
  });

  it("新規ファイルボタンから名前なしでファイルを作成する", async () => {
    const createMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ name: "新規ファイル", path: "新規ファイル.md", type: "file" }]
      }
    });
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "", name: "新規ファイル", path: "新規ファイル.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createMarkdownFile,
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規ファイル" }));

    expect(document.querySelector(".rail-tab-flight--open")).not.toBeInTheDocument();
    expect(createMarkdownFile).toHaveBeenCalledWith({ name: "新規ファイル" });
    expect((await screen.findAllByText("新規ファイル")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /新規ファイル/ }).some((button) => (
        button.classList.contains("file-tree-row--appearing")
      ))).toBe(true);
    });
  });

  it("メインパネルの新規ファイル作成は名前入力なしで作成する", async () => {
    const createMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ name: "新規ファイル", path: "新規ファイル.md", type: "file" }]
      }
    });
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "", name: "新規ファイル", path: "新規ファイル.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createMarkdownFile,
      readMarkdownFile
    });

    await renderApp();

    expect(screen.queryByLabelText("ファイル名を入力")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "新規ファイルを作成" }));

    expect(createMarkdownFile).toHaveBeenCalledWith({ name: "新規ファイル" });
    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });
    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    const tab = useEditorStore.getState().tabs[activeTabId!];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") expect(tab.path).toBe("新規ファイル.md");
  });

  it("新規フォルダボタンから名前なしでフォルダを作成する", async () => {
    const createFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ children: [], name: "新規フォルダ", path: "新規フォルダ", type: "folder" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createFolder
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "フォルダ作成" }));

    expect(document.querySelector(".sidebar-create-flight")).toBeInTheDocument();
    expect(createFolder).toHaveBeenCalledWith({ name: "新規フォルダ" });
    expect(await screen.findByRole("button", { name: /新規フォルダ/ })).toBeInTheDocument();
  });

  it("ワークスペースを開くボタンから既存フォルダを登録する", async () => {
    const openWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
        fileTree: [{ name: "index", path: "index.md", type: "file" }],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
      }
    });

    window.relic = makeRelicApi({ openWorkspace });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "ワークスペースを開く" }));

    expect(openWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Notes")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /index/ })).toBeInTheDocument();
  });

  it("ワークスペースを開き直したら前のワークスペースのタブを閉じる", async () => {
    const openWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-2", name: "Archive", path: "/tmp/Archive" },
        fileTree: [{ name: "old", path: "old.md", type: "file" }],
        pinnedPaths: [],
        workspaces: [{ id: "ws-2", name: "Archive", path: "/tmp/Archive" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      openWorkspace,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    expect(await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "ワークスペースを開く" }));

    await waitFor(() => {
      expect(screen.queryByText("読書メモ", { selector: ".pane-tab-name" })).not.toBeInTheDocument();
    });
    expect(useEditorStore.getState().tabs).toEqual({});
  });

  it("新規ワークスペース作成ボタンからワークスペースを登録する", async () => {
    const createNewWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-new", name: "Drafts", path: "/tmp/Drafts" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-new", name: "Drafts", path: "/tmp/Drafts" }]
      }
    });

    window.relic = makeRelicApi({ createNewWorkspace });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規ワークスペース" }));

    expect(createNewWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Drafts")).toBeInTheDocument();
  });

  it("新規ワークスペース作成後は前のワークスペースのタブを閉じる", async () => {
    const createNewWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-new", name: "Drafts", path: "/tmp/Drafts" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-new", name: "Drafts", path: "/tmp/Drafts" }]
      }
    });

    window.relic = makeRelicApi({
      createNewWorkspace,
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

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    expect(await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "新規ワークスペース" }));

    await waitFor(() => {
      expect(screen.queryByText("読書メモ", { selector: ".pane-tab-name" })).not.toBeInTheDocument();
    });
    expect(useEditorStore.getState().tabs).toEqual({});
  });

  it("登録済みワークスペースをクリックして切り替える", async () => {
    const switchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-2", name: "Archive", path: "/tmp/Archive" },
        fileTree: [{ name: "old", path: "old.md", type: "file" }],
        workspaces: [
          { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          { id: "ws-2", name: "Archive", path: "/tmp/Archive" }
        ]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          workspaces: [
            { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
            { id: "ws-2", name: "Archive", path: "/tmp/Archive" }
          ]
        }
      }),
      switchWorkspace
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Notes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    expect(switchWorkspace).toHaveBeenCalledWith({ workspaceId: "ws-2" });
    expect(await screen.findByRole("button", { name: /old/ })).toBeInTheDocument();
  });

  it("左レールのワークスペース名をダブルクリックで変更する", async () => {
    const renameWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "Renamed", path: "/tmp/Renamed" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "Renamed", path: "/tmp/Renamed" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameWorkspace
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    fireEvent.change(await screen.findByLabelText("名前を変更"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameWorkspace).toHaveBeenCalledWith({ name: "Renamed", workspaceId: "ws-1" });
    });
  });

  it("左レールのワークスペース名変更後は少しレールを開いたままにする", async () => {
    const renameWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "Renamed", path: "/tmp/Renamed" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "Renamed", path: "/tmp/Renamed" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameWorkspace
    });

    await renderApp();

    const rail = screen.getByRole("navigation");
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    fireEvent.change(await screen.findByLabelText("名前を変更"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameWorkspace).toHaveBeenCalledWith({ name: "Renamed", workspaceId: "ws-1" });
    });
    expect(rail).toHaveClass("rail--workspace-editing");

    await waitFor(() => {
      expect(rail).not.toHaveClass("rail--workspace-editing");
    }, { timeout: 1500 });
  });

  it("左レールのワークスペース名変更中はレールを開いたままにする", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      })
    });

    await renderApp();

    const rail = screen.getByRole("navigation");
    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));

    expect(rail).toHaveClass("rail--workspace-editing");

    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Escape" });

    expect(rail).not.toHaveClass("rail--workspace-editing");
  });

  it("左レールのワークスペース名変更でIME確定中のEnterではリネーム確定しない", async () => {
    const renameWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameWorkspace
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "小説メモ" } });
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });

    expect(renameWorkspace).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameWorkspace).toHaveBeenCalledWith({ name: "小説メモ", workspaceId: "ws-1" });
    });
  });

  it("左レールのワークスペース名変更でIME確定後のkeyCode 229のEnterは確定する", async () => {
    const renameWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameWorkspace
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "小説メモ" } });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });

    await waitFor(() => {
      expect(renameWorkspace).toHaveBeenCalledWith({ name: "小説メモ", workspaceId: "ws-1" });
    });
  });

  it("左レールのワークスペース名変更で文字確定Enterのkeyupではリネーム確定しない", async () => {
    const renameWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "小説メモ", path: "/tmp/小説メモ" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameWorkspace
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "小説メモ" } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });
    expect(renameWorkspace).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input);
    fireEvent.keyUp(input, { key: "Enter" });

    expect(renameWorkspace).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameWorkspace).toHaveBeenCalledWith({ name: "小説メモ", workspaceId: "ws-1" });
    });
  });

  it("左レールのワークスペース名変更が失敗してもリネーム状態を終了する", async () => {
    const renameWorkspace = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "WORKSPACE_RENAME_FAILED", message: "ワークスペース名を変更できませんでした。" }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      renameWorkspace
    });

    await renderApp();

    fireEvent.doubleClick(await screen.findByRole("button", { name: "Notes" }));
    const input = await screen.findByLabelText("名前を変更");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.queryByLabelText("名前を変更")).not.toBeInTheDocument();
    });
  });

  it("左レールのワークスペース右クリックメニューから一覧削除する", async () => {
    const removeWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      removeWorkspace
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Notes" }));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Notes を一覧から削除" }));

    expect(removeWorkspace).toHaveBeenCalledWith({ workspaceId: "ws-1" });
  });

  it("左レールのワークスペース右クリックメニューからフォルダーを開く", async () => {
    const revealWorkspaceItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
          fileTree: [],
          pinnedPaths: [],
          workspaces: [{ id: "ws-1", name: "Notes", path: "/tmp/Notes" }]
        }
      }),
      revealWorkspaceItem
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Notes" }));
    const menu = await screen.findByRole("menu");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "ファイルの場所を表示" }));

    await waitFor(() => {
      expect(revealWorkspaceItem).toHaveBeenCalledWith({ path: "", workspaceId: "ws-1" });
    });
  });
});
