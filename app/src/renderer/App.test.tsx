import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { defaultAutoSyncSettings, defaultEditorSettings, defaultFeatureToggles, defaultGitHubIntegrationSettings, type GitHubAuthStatus } from "../shared/ipc";
import { App } from "./App";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  const defaultGitHubStatus: GitHubAuthStatus = {
    configured: true,
    connected: false,
    login: null,
    scopes: [],
    tokenType: null
  };

  return {
    connectGitRemote: vi.fn().mockResolvedValue({
      ok: true,
      value: [{ isOrigin: true, name: "origin", url: "https://github.com/akihisa/relic.git" }]
    }),
    connectGitHubAccount: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...defaultGitHubStatus,
        connected: true,
        login: "akihisa",
        scopes: ["repo"],
        tokenType: "bearer"
      }
    }),
    createFolder: vi.fn(),
    createGitBranch: vi.fn().mockResolvedValue({
      ok: true,
      value: [{ isCurrent: true, name: "main" }]
    }),
    createGitCommit: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        author: "Test User",
        changedFiles: ["note.md"],
        date: "2026-05-05T00:00:00.000Z",
        hash: "abc123",
        message: "Initial commit"
      }
    }),
    createGitTag: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    createLinkedMarkdownFile: vi.fn(),
    createMarkdownFile: vi.fn(),
    disconnectGitHubAccount: vi.fn().mockResolvedValue({ ok: true, value: defaultGitHubStatus }),
    deleteGitTag: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    duplicateMarkdownFile: vi.fn(),
    getBacklinks: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getGitBranches: vi.fn().mockResolvedValue({
      ok: true,
      value: [{ isCurrent: true, name: "main" }]
    }),
    getGitCommitHistory: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getGitCommitDiff: vi.fn().mockResolvedValue({ ok: true, value: { commit: { author: "Test User", changedFiles: [], date: "2026-05-05T00:00:00.000Z", hash: "abc123", message: "Initial commit" }, entries: [] } }),
    getGitHubAuthStatus: vi.fn().mockResolvedValue({ ok: true, value: defaultGitHubStatus }),
    getGitHubIntegrationSettings: vi.fn().mockResolvedValue({ ok: true, value: defaultGitHubIntegrationSettings }),
    getGitRemotes: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: null, initialized: false } }),
    getGitTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getGitWorkingChanges: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getAppInfo: vi.fn().mockResolvedValue({ ok: true, value: { name: "Relic", platform: "darwin", version: "0.0.0" } }),
    getEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultEditorSettings, language: "ja" } }),
    getFrontmatterValueCandidates: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getMarkdownTemplates: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceState: vi.fn().mockResolvedValue({
      ok: true,
      value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] }
    }),
    moveItemToTrash: vi.fn(),
    openWorkspace: vi.fn(),
    readMarkdownFile: vi.fn(),
    removeWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    renameMarkdownFile: vi.fn(),
    renameFolder: vi.fn(),
    saveEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    searchWorkspace: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    switchGitBranch: vi.fn().mockResolvedValue({
      ok: true,
      value: [{ isCurrent: true, name: "main" }]
    }),
    switchWorkspace: vi.fn(),
    writeMarkdownFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    moveFolder: vi.fn(),
    moveMarkdownFile: vi.fn(),
    initializeGitRepository: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: "main", initialized: true } }),
    pullGitBranch: vi.fn().mockResolvedValue({ ok: true, value: { errors: [], message: "pull ok", updatedRefs: ["main"] } }),
    pushGitBranch: vi.fn().mockResolvedValue({ ok: true, value: { errors: [], message: "push ok", updatedRefs: ["main"] } }),
    pushGitTag: vi.fn().mockResolvedValue({ ok: true, value: { errors: [], message: "tag ok", updatedRefs: ["v1.0.0"] } }),
    applySearchAndReplace: vi.fn(),
    replaceInFile: vi.fn(),
    searchAndReplace: vi.fn(),
    cloneGitHubRepository: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    createNewWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    togglePin: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    getGitSyncPreview: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        branch: "main",
        incomingCommits: [],
        outgoingChanges: [],
        remoteName: "origin",
        remoteUrl: "https://github.com/owner/repo.git",
        upstream: "origin/main"
      }
    }),
    getGitConflicts: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    resolveGitConflict: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getAutoSyncSettings: vi.fn().mockResolvedValue({ ok: true, value: defaultAutoSyncSettings }),
    saveAutoSyncSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: defaultFeatureToggles }),
    saveFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveGitHubIntegrationSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    saveUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    getFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    saveFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    mergeFiles: vi.fn().mockResolvedValue({ ok: true, value: "merged.md" }),
    splitFileByHeading: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    ...overrides
  } as typeof window.relic;
}

const withWorkspace = {
  activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
  fileTree: [],
  pinnedPaths: [],
  workspaces: []
};

function renderApp() {
  return render(<App />);
}

describe("App", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    useEditorStore.setState({ tabs: {}, leftPane: { activeTabId: null, history: [], tabIds: [] }, rightPane: { activeTabId: null, history: [], tabIds: [] }, isSplit: false, focusedPane: "left" });
    useUiStore.setState({ activeSidebarView: "files", isRightPanelOpen: true, isSidebarOpen: true, isTypewriterMode: false, rightPanelView: "outline" });
  });

  it("ビュー切り替えナビとメインエリアが表示される", async () => {
    window.relic = makeRelicApi();

    await renderApp();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(await screen.findByText("書く場所を選ぶ")).toBeInTheDocument();
  });

  it("ワークスペースを開くとファイルツリーが表示される", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      })
    });

    await renderApp();

    expect(await screen.findByRole("button", { name: /読書メモ/ })).toBeInTheDocument();
  });

  it("ファイルツリーのノートをクリックするとタブが開く", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    expect(window.relic!.readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    expect(await screen.findByText("読書メモ")).toBeInTheDocument();
  });

  it("ツールバーのMarkdownボタンを開いているタブへ反映する", async () => {
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

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "太字" }));

    await waitFor(() => {
      const activeTabId = useEditorStore.getState().leftPane.activeTabId;
      expect(activeTabId).not.toBeNull();
      expect(useEditorStore.getState().tabs[activeTabId!]?.content).toContain("**");
    });
  });

  it("ファイルツリーで開いているノートを再選択するとタブを閉じる", async () => {
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

    fireEvent.click(fileButton);

    expect(useEditorStore.getState().leftPane.activeTabId).toBeNull();
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

  it("右パネルのアウトライン・リンクボタンを閉じた後も再度開ける", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByText("Notes");

    const outlineButton = screen.getByRole("button", { name: "アウトライン" });
    const linksButton = screen.getByRole("button", { name: "リンク" });

    fireEvent.click(outlineButton);

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

    fireEvent.click(outlineButton);

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

    expect(screen.queryByRole("button", { name: "フロントマター" })).not.toBeInTheDocument();

    fireEvent.click(linksButton);

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("links");

    fireEvent.click(linksButton);

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("links");

    fireEvent.click(outlineButton);

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
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

    fireEvent.click(splitButton);
    expect(panes).toHaveClass("panes-container--closing-split");
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
    expect(useUiStore.getState().activeSidebarView).toBe("search");

    fireEvent.keyDown(window, { key: "b", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(false);

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    expect(useUiStore.getState().isSidebarOpen).toBe(true);
    expect(useUiStore.getState().activeSidebarView).toBe("files");
  });

  it("Git ビューから GitHub 接続を開始できる", async () => {
    const connectGitHubAccount = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        configured: true,
        connected: true,
        login: "akihisa",
        scopes: ["repo"],
        tokenType: "bearer"
      }
    });

    window.relic = makeRelicApi({
      connectGitHubAccount,
      getGitHubAuthStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          configured: true,
          connected: false,
          login: null,
          scopes: [],
          tokenType: null
        }
      }),
      getGitStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: { currentBranch: "main", initialized: true }
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: withWorkspace
      })
    });

    useUiStore.setState({
      activeSidebarView: "git",
      isRightPanelOpen: true,
      isSidebarOpen: true,
      isTypewriterMode: false,
      rightPanelView: "outline"
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "GitHubアカウントを接続" }));

    await waitFor(() => {
      expect(connectGitHubAccount).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("akihisa")).toBeInTheDocument();
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
    expect(useEditorStore.getState().tabs[activeTabId!]?.path).toBe("新規ファイル.md");
  });

  it("新規ファイルボタンからテンプレートを選んで名前なしでファイルを作成する", async () => {
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
      createMarkdownFile,
      readMarkdownFile,
      getMarkdownTemplates: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ name: "日記", path: "templates/日記.md" }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    fireEvent.change(await screen.findByLabelText("テンプレート"), {
      target: { value: "templates/日記.md" }
    });
    fireEvent.click(screen.getByRole("button", { name: "新規ファイル" }));

    expect(createMarkdownFile).toHaveBeenCalledWith({ name: "新規ファイル", templatePath: "templates/日記.md" });
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

    fireEvent.click(await screen.findByRole("button", { name: "フォルダを開く" }));

    expect(openWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Notes")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /index/ })).toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole("button", { name: "新規ワークスペースを作成" }));

    expect(createNewWorkspace).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Drafts")).toBeInTheDocument();
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

  it("RenameBar からアクティブファイルをリネームする", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
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
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      }),
      renameMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByTitle("クリックして名前を変更"));
    fireEvent.change(container.querySelector(".rename-bar-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".rename-bar-form") as HTMLFormElement);

    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
    expect((await screen.findAllByText("読書ログ")).length).toBeGreaterThan(0);
  });

  it("ファイルツリーの右クリックメニューからインラインでリネームする", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
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
      renameMarkdownFile
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "名前を変更" }));
    fireEvent.change(screen.getByLabelText("名前を変更"), { target: { value: "読書ログ" } });
    fireEvent.keyDown(screen.getByLabelText("名前を変更"), { key: "Enter" });

    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("ファイルツリーの右クリックメニューからファイルを複製する", async () => {
    const duplicateMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書メモ のコピー", path: "読書メモ のコピー.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "読書メモ のコピー", path: "読書メモ のコピー.md", type: "file" }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      duplicateMarkdownFile,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      })
    });

    await renderApp();

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "複製" }));

    await waitFor(() => {
      expect(duplicateMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /読書メモ のコピー/ }).some((button) => (
        button.classList.contains("file-tree-row--appearing")
      ))).toBe(true);
    });
  });

  it("コマンドパレットからアクティブファイルを複製する", async () => {
    const duplicateMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文テスト", name: "読書メモ のコピー", path: "読書メモ のコピー.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "読書メモ のコピー", path: "読書メモ のコピー.md", type: "file" }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      duplicateMarkdownFile,
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
    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    fireEvent.click(await screen.findByText("ファイルを複製: 読書メモ"));

    await waitFor(() => {
      expect(duplicateMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("コマンドパレットを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });

    const palette = container.querySelector(".command-palette");
    if (!(palette instanceof HTMLElement)) throw new Error("command palette was not rendered");

    fireEvent.keyDown(window, { key: "Escape" });

    const overlay = container.querySelector(".modal-overlay");
    if (!(overlay instanceof HTMLElement)) throw new Error("modal overlay was not rendered");

    expect(palette).toHaveClass("command-palette--closing");
    expect(overlay).toHaveClass("modal-overlay--closing");
  });

  it("クイックスイッチャーを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    fireEvent.keyDown(window, { key: "p", metaKey: true });

    const switcher = container.querySelector(".quick-switcher");
    if (!(switcher instanceof HTMLElement)) throw new Error("quick switcher was not rendered");

    fireEvent.keyDown(window, { key: "Escape" });

    const overlay = container.querySelector(".modal-overlay");
    if (!(overlay instanceof HTMLElement)) throw new Error("modal overlay was not rendered");

    expect(switcher).toHaveClass("quick-switcher--closing");
    expect(overlay).toHaveClass("modal-overlay--closing");
  });

  it("コマンドパレットからアクティブファイルをゴミ箱に移動する", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({ ok: true, value: withWorkspace });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      moveItemToTrash,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.keyDown(window, { key: "P", metaKey: true, shiftKey: true });
    fireEvent.click(await screen.findByText("ファイルを削除: 読書メモ"));

    await waitFor(() => {
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "読書メモ.md", type: "file" });
    });
    expect(confirmSpy).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("ファイルとフォルダをドラッグ&ドロップで移動できる", async () => {
    const movedWorkspaceState = {
      ...withWorkspace,
      fileTree: [
        {
          children: [{ name: "note", path: "archive/note.md", type: "file" }],
          name: "archive",
          path: "archive",
          type: "folder"
        },
        { children: [], name: "drafts", path: "drafts", type: "folder" }
      ]
    };
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: movedWorkspaceState
      }
    });
    const moveFolder = vi.fn().mockResolvedValue({ ok: true, value: movedWorkspaceState });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      moveFolder,
      moveMarkdownFile
    });

    await renderApp();

    const fileRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });

    fireEvent.dragStart(fileRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });

    expect(fileRow).toHaveClass("dragging");

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    fireEvent.dragEnd(fileRow);

    expect(fileRow).not.toHaveClass("dragging");

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
    });

    fireEvent.dragStart(draftsRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "drafts", type: "folder" }) }
    });

    await waitFor(() => {
      expect(moveFolder).toHaveBeenCalledWith({ destinationFolder: "archive", path: "drafts" });
    });
  });

  it("ファイルとフォルダを複数選択できる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      })
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });

    expect(noteRow).toHaveClass("selected");
    expect(draftsRow).toHaveClass("selected");

    fireEvent.click(archiveRow, { shiftKey: true });

    expect(noteRow).not.toHaveClass("selected");
    expect(draftsRow).toHaveClass("selected");
    expect(archiveRow).toHaveClass("selected");
  });

  it("複数選択したファイルとフォルダをまとめてドラッグ移動できる", async () => {
    const movedWorkspaceState = {
      ...withWorkspace,
      fileTree: [
        {
          children: [
            { name: "note", path: "archive/note.md", type: "file" },
            { children: [], name: "drafts", path: "archive/drafts", type: "folder" }
          ],
          name: "archive",
          path: "archive",
          type: "folder"
        }
      ]
    };
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: movedWorkspaceState
      }
    });
    const moveFolder = vi.fn().mockResolvedValue({ ok: true, value: movedWorkspaceState });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      moveFolder,
      moveMarkdownFile
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const setData = vi.fn();

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });
    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData }
    });
    const payload = setData.mock.calls[0]?.[1] as string;

    expect(JSON.parse(payload).items).toEqual([
      { path: "note.md", type: "file" },
      { path: "drafts", type: "folder" }
    ]);

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => payload }
    });

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
      expect(moveFolder).toHaveBeenCalledWith({ destinationFolder: "archive", path: "drafts" });
    });
  });

  it("複数選択したファイルとフォルダをまとめてゴミ箱に移動できる", async () => {
    const moveItemToTrash = vi.fn().mockResolvedValue({ ok: true, value: withWorkspace });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "drafts", path: "drafts", type: "folder" }
          ]
        }
      }),
      moveItemToTrash
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });
    fireEvent.contextMenu(noteRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "選択した項目をゴミ箱に移動" }));

    expect(noteRow).toHaveClass("file-tree-row--removing");

    await waitFor(() => {
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "note.md", type: "file" });
      expect(moveItemToTrash).toHaveBeenCalledWith({ path: "drafts", type: "folder" });
    });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("2件"));

    confirmSpy.mockRestore();
  });

  it("ファイル・フォルダをピン留めし、ピン留めセクションに表示して解除できる", async () => {
    const togglePin = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { children: [], name: "資料", path: "資料", type: "folder" }
          ],
          pinnedPaths: ["読書メモ.md", "資料"]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { children: [], name: "資料", path: "資料", type: "folder" }
          ],
          pinnedPaths: []
        }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { children: [], name: "資料", path: "資料", type: "folder" }
          ],
          pinnedPaths: []
        }
      }),
      togglePin
    });

    await renderApp();

    fireEvent.click((await screen.findAllByTitle("ピン留め"))[0]);

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledWith("読書メモ.md");
    });
    expect(await screen.findByText("ピン留め")).toBeInTheDocument();
    expect(screen.getAllByTitle("ピン留めを解除").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getAllByTitle("ピン留めを解除")[0]);

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledTimes(2);
    });
  });

  it("設定ビューでフォントサイズを変更すると saveEditorSettings が呼ばれる", async () => {
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({ saveEditorSettings });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    const input = await screen.findByDisplayValue("16");

    fireEvent.change(input, { target: { value: "18" } });

    expect(saveEditorSettings).toHaveBeenCalledWith(
      expect.objectContaining({ fontSize: 18 })
    );
  });

  it("検索サイドバーにワークスペースタグを表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getWorkspaceTags: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          { count: 2, tag: "資料" },
          { count: 1, tag: "キャラ/主人公" }
        ]
      })
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    expect(await screen.findByRole("button", { name: "#資料" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "#キャラ/主人公" })).toBeInTheDocument();
  });

  it("検索語句を入力すると検索結果を表示し、クリックでファイルを開く", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          fileName: "読書メモ",
          lineNumber: 3,
          lineText: "一致した行",
          path: "読書メモ.md"
        }
      ]
    });
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "一致した行", name: "読書メモ", path: "読書メモ.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile,
      searchWorkspace
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "検索" }), {
      target: { value: "一致" }
    });

    expect(await screen.findByText("3: 一致した行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /読書メモ/ }));

    expect(searchWorkspace).toHaveBeenCalledWith({ mode: "fullText", query: "一致" });
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
  });

  it("検索中は読み込み反応を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace: vi.fn().mockReturnValue(new Promise(() => undefined))
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.change(screen.getByRole("textbox", { name: "検索" }), {
      target: { value: "draft" }
    });

    const loading = await screen.findByText("読み込んでいます…");
    expect(loading).toHaveClass("list-loading-note");
  });

  it("タグピルをクリックするとタグ検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ fileName: "資料ノート", lineNumber: null, lineText: "#資料", path: "資料ノート.md" }]
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getWorkspaceTags: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ count: 1, tag: "資料" }]
      }),
      searchWorkspace
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.click(await screen.findByRole("button", { name: "#資料" }));

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "tag", query: "資料" });
    });
    expect((await screen.findAllByText("#資料")).length).toBeGreaterThan(0);
  });

  it("無効な正規表現の検索エラーを表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "SEARCH_REGEX_INVALID", message: "正規表現が正しくありません。" }
      })
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.change(await screen.findByRole("combobox", { name: "検索モード" }), {
      target: { value: "regex" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "検索" }), {
      target: { value: "[" }
    });

    expect(await screen.findByText("正規表現が正しくありません。")).toBeInTheDocument();
  });

  it("トーストを閉じると退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createMarkdownFile: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "CREATE_FAILED", message: "ファイルを作成できませんでした。" }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "新規ファイル" }));

    const toast = await screen.findByText("ファイルを作成できませんでした。");
    expect(toast).toBeInstanceOf(HTMLElement);
    fireEvent.click(toast);

    expect(toast).toHaveClass("toast--closing");
  });

  it("フロントマター検索で field と値を渡す", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ fileName: "読書メモ", lineNumber: null, lineText: "status: draft", path: "読書メモ.md" }]
    });

    window.relic = makeRelicApi({
      getUserDefinedFields: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ choices: ["draft", "published"], name: "status", type: "select" }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.change(await screen.findByRole("combobox", { name: "検索モード" }), {
      target: { value: "frontmatter" }
    });
    fireEvent.change(screen.getByLabelText("フロントマターフィールド"), {
      target: { value: "status" }
    });
    fireEvent.change(screen.getAllByLabelText("検索")[1], {
      target: { value: "draft" }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({
        frontmatterField: "status",
        mode: "frontmatter",
        query: "draft"
      });
    });
    expect(await screen.findByText("status: draft")).toBeInTheDocument();
  });

  it("Gitビューでワークスペースを初期化できる", async () => {
    const initializeGitRepository = vi.fn().mockResolvedValue({
      ok: true,
      value: { currentBranch: "main", initialized: true }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: null, initialized: false } }),
      initializeGitRepository
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    fireEvent.click(await screen.findByRole("button", { name: "このワークスペースでGitを初期化" }));

    await waitFor(() => {
      expect(initializeGitRepository).toHaveBeenCalled();
    });
    expect(await screen.findByText("初期化済み")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("Gitビューでブランチを作成できる", async () => {
    const createGitBranch = vi.fn().mockResolvedValue({
      ok: true,
      value: [
        { isCurrent: false, name: "feature/test" },
        { isCurrent: true, name: "main" }
      ]
    });

    window.relic = makeRelicApi({
      createGitBranch,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: "main", initialized: true } }),
      getGitBranches: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ isCurrent: true, name: "main" }]
      })
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    fireEvent.change(await screen.findByLabelText("新規Gitブランチ名"), {
      target: { value: "feature/test" }
    });
    fireEvent.click(screen.getByRole("button", { name: "ブランチを作成" }));

    await waitFor(() => {
      expect(createGitBranch).toHaveBeenCalledWith({ name: "feature/test" });
    });
    expect(await screen.findByText("feature/test")).toBeInTheDocument();
  });

  it("未コミット変更があるとブランチ切り替え前の確認を表示する", async () => {
    const switchGitBranch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: "GIT_BRANCH_SWITCH_DIRTY",
          message: "未コミット変更があります。切り替え前に確認してください。"
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [
          { isCurrent: true, name: "feature/test" },
          { isCurrent: false, name: "main" }
        ]
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: "main", initialized: true } }),
      getGitBranches: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          { isCurrent: false, name: "feature/test" },
          { isCurrent: true, name: "main" }
        ]
      }),
      switchGitBranch
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    fireEvent.click(await screen.findByRole("button", { name: /feature\/test/ }));

    expect(await screen.findByRole("button", { name: "コミットして切り替える" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "変更を残したまま切り替える" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "変更を残したまま切り替える" }));

    await waitFor(() => {
      expect(switchGitBranch).toHaveBeenLastCalledWith({
        allowDirty: true,
        name: "feature/test"
      });
    });
  });

  it("Gitビューでコミットメッセージだけを入力して履歴に追加する", async () => {
    const createGitCommit = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        author: "Test User",
        changedFiles: ["note.md"],
        date: "2026-05-05T00:00:00.000Z",
        hash: "def456",
        message: "Save note"
      }
    });

    window.relic = makeRelicApi({
      createGitCommit,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: "main", initialized: true } }),
      getGitWorkingChanges: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ path: "note.md", status: "modified" }]
      }),
      getGitCommitHistory: vi.fn().mockResolvedValue({ ok: true, value: [] })
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    await screen.findByText("コミット履歴はまだありません。");
    fireEvent.change(await screen.findByLabelText("コミットメッセージ"), { target: { value: "Save note" } });
    fireEvent.click(screen.getByRole("button", { name: "コミット" }));

    await waitFor(() => {
      expect(createGitCommit).toHaveBeenCalledWith({
        message: "Save note"
      });
    });
    expect(screen.getByLabelText("コミットメッセージ")).toHaveValue("");
  });

  it("Gitビューでコミットを選ぶと差分を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: "main", initialized: true } }),
      getGitWorkingChanges: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      getGitCommitHistory: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          {
            author: "Test User",
            changedFiles: [],
            date: "2026-05-05T00:00:00.000Z",
            hash: "def456",
            message: "Update note"
          }
        ]
      }),
      getGitCommitDiff: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          commit: {
            author: "Test User",
            changedFiles: ["note.md"],
            date: "2026-05-05T00:00:00.000Z",
            hash: "def456",
            message: "Update note"
          },
          entries: [
            {
              after: "v2",
              before: "v1",
              path: "note.md",
              status: "modified"
            }
          ]
        }
      })
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));

    expect(await screen.findByText("Update note")).toBeInTheDocument();
    expect(await screen.findByText("note.md")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
  });

  it("Gitビューで選択コミットにタグを作成して一覧に表示する", async () => {
    const createGitTag = vi.fn().mockResolvedValue({
      ok: true,
      value: [
        {
          annotated: true,
          date: "2026-05-05T00:00:00.000Z",
          message: "first release",
          name: "v1.0.0",
          targetHash: "def456",
          targetMessage: "Update note"
        }
      ]
    });

    window.relic = makeRelicApi({
      createGitTag,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: "main", initialized: true } }),
      getGitWorkingChanges: vi.fn().mockResolvedValue({ ok: true, value: [] }),
      getGitCommitHistory: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          {
            author: "Test User",
            changedFiles: [],
            date: "2026-05-05T00:00:00.000Z",
            hash: "def456",
            message: "Update note"
          }
        ]
      })
    });

    await renderApp();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    fireEvent.change(await screen.findByLabelText("新規Gitタグ名"), { target: { value: "v1.0.0" } });
    fireEvent.change(screen.getByLabelText("Gitタグメモ"), { target: { value: "first release" } });
    fireEvent.click(screen.getByRole("button", { name: "タグを作成" }));

    await waitFor(() => {
      expect(createGitTag).toHaveBeenCalledWith({
        hash: "def456",
        message: "first release",
        name: "v1.0.0"
      });
    });
    expect(await screen.findByText(/v1\.0\.0/)).toBeInTheDocument();
  });

  it("右パネルにアウトゴーイングリンクを表示する", async () => {
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve({
      ok: true as const,
      value:
        path === "埋め込み.md"
          ? { content: "埋め込み本文", name: "埋め込み", path: "埋め込み.md" }
          : {
              content: "[[参照先|表示名]]\n![[埋め込み]]",
              name: "読書メモ",
              path: "読書メモ.md"
            }
    }));

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(await screen.findByText("アウトゴーイング")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "表示名" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("埋め込み").length).toBeGreaterThan(0);
  });

  it("右パネルにバックリンクを表示し、クリックすると参照元を開く", async () => {
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve({
      ok: true as const,
      value:
        path === "source.md"
          ? { content: "参照元本文", name: "source", path: "source.md" }
          : { content: "# Target", name: "target", path: "target.md" }
    }));

    window.relic = makeRelicApi({
      getBacklinks: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ count: 2, sourceName: "source", sourcePath: "source.md" }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "target", path: "target.md", type: "file" },
            { name: "source", path: "source.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /target/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    expect(await screen.findByText("バックリンク")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "source" }));

    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "source.md" });
  });

  it("未作成リンクをクリックすると同じフォルダにファイルを作成して開く", async () => {
    const readMarkdownFile = vi.fn(({ path }: { path: string }) => Promise.resolve(
      path === "folder/読書メモ.md"
        ? {
            ok: true as const,
            value: { content: "[[新規ノート]]", name: "読書メモ", path: "folder/読書メモ.md" }
          }
        : {
            ok: false as const,
            error: { code: "FILE_READ_FAILED", message: "ファイルを読み込めませんでした。" }
          }
    ));
    const createLinkedMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "", name: "新規ノート", path: "folder/新規ノート.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            {
              children: [
                { name: "読書メモ", path: "folder/読書メモ.md", type: "file" },
                { name: "新規ノート", path: "folder/新規ノート.md", type: "file" }
              ],
              name: "folder",
              path: "folder",
              type: "folder"
            }
          ]
        }
      }
    });

    window.relic = makeRelicApi({
      createLinkedMarkdownFile,
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "読書メモ", path: "folder/読書メモ.md", type: "file" }],
              name: "folder",
              path: "folder",
              type: "folder"
            }
          ]
        }
      }),
      readMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));
    fireEvent.click(await screen.findByRole("button", { name: "新規ノート" }));

    await waitFor(() => {
      expect(createLinkedMarkdownFile).toHaveBeenCalledWith({ path: "folder/新規ノート.md" });
    });
    expect((await screen.findAllByText("新規ノート")).length).toBeGreaterThan(0);
  });

  it("機能トグル git=false でナビから Git ビューが非表示になる", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultFeatureToggles, git: false } }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "Git" })).toBeNull();
  });

  it("機能トグル tools=false でナビから Tools ビューが非表示になる", async () => {
    window.relic = makeRelicApi({
      getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultFeatureToggles, tools: false } }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByRole("button", { name: "ファイル" });
    expect(screen.queryByRole("button", { name: "ツール" })).toBeNull();
  });
});
