import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { defaultAutoSyncSettings, defaultEditorSettings, type GitHubAuthStatus } from "../shared/ipc";
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
    getGitRemotes: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getGitStatus: vi.fn().mockResolvedValue({ ok: true, value: { currentBranch: null, initialized: false } }),
    getGitTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getGitWorkingChanges: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getAppInfo: vi.fn().mockResolvedValue({ ok: true, value: { name: "Relic", platform: "darwin", version: "0.0.0" } }),
    getEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: defaultEditorSettings }),
    getWorkspaceTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceState: vi.fn().mockResolvedValue({
      ok: true,
      value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] }
    }),
    moveItemToTrash: vi.fn(),
    openWorkspace: vi.fn(),
    readMarkdownFile: vi.fn(),
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
    getFrontmatterCandidates: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    createFrontmatterTemplate: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
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
    getGitSyncPreview: vi.fn().mockResolvedValue({ ok: true, value: { incomingCommits: [], outgoingChanges: [] } }),
    getGitConflicts: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    resolveGitConflict: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getAutoSyncSettings: vi.fn().mockResolvedValue({ ok: true, value: defaultAutoSyncSettings }),
    saveAutoSyncSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  } as typeof window.relic;
}

const withWorkspace = {
  activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
  fileTree: [],
  pinnedPaths: [],
  workspaces: []
};

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
    useUiStore.setState({ activeSidebarView: "files", isFocusMode: false, isRightPanelOpen: true, isSidebarOpen: true, isTypewriterMode: false, rightPanelView: "outline" });
  });

  it("ビュー切り替えナビとメインエリアが表示される", async () => {
    window.relic = makeRelicApi();

    render(<App />);

    expect(screen.getByRole("navigation", { name: "ビュー切り替え" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(await screen.findByText("ワークスペース未選択")).toBeInTheDocument();
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

    render(<App />);

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

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    expect(window.relic!.readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    expect(await screen.findByText("読書メモ")).toBeInTheDocument();
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
      isFocusMode: false,
      isRightPanelOpen: true,
      isSidebarOpen: true,
      isTypewriterMode: false,
      rightPanelView: "outline"
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "GitHubアカウントを接続" }));

    await waitFor(() => {
      expect(connectGitHubAccount).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("akihisa")).toBeInTheDocument();
  });

  it("新規ノートフォームからファイルを作成する", async () => {
    const createMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createMarkdownFile
    });

    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "新規ノート名" }), {
      target: { value: "読書メモ" }
    });
    fireEvent.click(screen.getByRole("button", { name: "作成" }));

    expect(createMarkdownFile).toHaveBeenCalledWith({ name: "読書メモ" });
    expect(await screen.findByRole("button", { name: /読書メモ/ })).toBeInTheDocument();
  });

  it("新規フォルダフォームからフォルダを作成する", async () => {
    const createFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ children: [], name: "資料", path: "資料", type: "folder" }]
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      createFolder
    });

    render(<App />);

    fireEvent.change(await screen.findByRole("textbox", { name: "新規フォルダ名" }), {
      target: { value: "資料" }
    });
    fireEvent.click(screen.getByRole("button", { name: "フォルダ作成" }));

    expect(createFolder).toHaveBeenCalledWith({ name: "資料" });
    expect(await screen.findByRole("button", { name: /資料/ })).toBeInTheDocument();
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

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Archive" }));

    expect(switchWorkspace).toHaveBeenCalledWith({ workspaceId: "ws-2" });
    expect(await screen.findByRole("button", { name: /old/ })).toBeInTheDocument();
  });

  it("設定ビューでフォントサイズを変更すると saveEditorSettings が呼ばれる", async () => {
    const saveEditorSettings = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({ saveEditorSettings });

    render(<App />);

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

    render(<App />);

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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "検索" }), {
      target: { value: "一致" }
    });

    expect(await screen.findByText("3: 一致した行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /読書メモ/ }));

    expect(searchWorkspace).toHaveBeenCalledWith({ mode: "fullText", query: "一致" });
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
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

    render(<App />);

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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "検索" }));
    fireEvent.change(await screen.findByRole("combobox", { name: "検索モード" }), {
      target: { value: "regex" }
    });
    fireEvent.change(screen.getByRole("textbox", { name: "検索" }), {
      target: { value: "[" }
    });

    expect(await screen.findByText("正規表現が正しくありません。")).toBeInTheDocument();
  });

  it("フロントマター検索で field と値を渡す", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: [{ fileName: "読書メモ", lineNumber: null, lineText: "status: draft", path: "読書メモ.md" }]
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getFrontmatterCandidates: vi.fn().mockResolvedValue({ ok: true, value: { status: ["draft", "published"] } }),
      searchWorkspace
    });

    render(<App />);

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

    render(<App />);

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

    render(<App />);

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

    render(<App />);

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

  it("Gitビューでローカルコミットを作成して履歴に追加する", async () => {
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    await screen.findByText("コミット履歴はまだありません。");
    fireEvent.change(await screen.findByLabelText("Git作者名"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText("Git作者メール"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("Gitコミットメッセージ"), { target: { value: "Save note" } });
    fireEvent.click(screen.getByRole("button", { name: "ローカルコミットを作成" }));

    await waitFor(() => {
      expect(createGitCommit).toHaveBeenCalledWith({
        authorEmail: "test@example.com",
        authorName: "Test User",
        message: "Save note"
      });
    });
    expect(screen.getByLabelText("Gitコミットメッセージ")).toHaveValue("");
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

    render(<App />);

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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    fireEvent.change(await screen.findByLabelText("Git作者名"), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText("Git作者メール"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("新規Gitタグ名"), { target: { value: "v1.0.0" } });
    fireEvent.change(screen.getByLabelText("Gitタグメモ"), { target: { value: "first release" } });
    fireEvent.click(screen.getByRole("button", { name: "タグを作成" }));

    await waitFor(() => {
      expect(createGitTag).toHaveBeenCalledWith({
        hash: "def456",
        message: "first release",
        name: "v1.0.0",
        taggerEmail: "test@example.com",
        taggerName: "Test User"
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

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));

    expect(await screen.findByText("Outgoing")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "表示名" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("埋め込み").length).toBeGreaterThan(0);
    expect(screen.getByText("Embed")).toBeInTheDocument();
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

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /target/ }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));

    expect(await screen.findByText("Backlinks")).toBeInTheDocument();
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

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Links" }));
    fireEvent.click(await screen.findByRole("button", { name: "新規ノート" }));

    await waitFor(() => {
      expect(createLinkedMarkdownFile).toHaveBeenCalledWith({ path: "folder/新規ノート.md" });
    });
    expect((await screen.findAllByText("新規ノート")).length).toBeGreaterThan(0);
  });
});
