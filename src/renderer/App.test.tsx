import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings } from "../shared/ipc";
import { App } from "./App";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  return {
    createFolder: vi.fn(),
    createLinkedMarkdownFile: vi.fn(),
    createMarkdownFile: vi.fn(),
    duplicateMarkdownFile: vi.fn(),
    getBacklinks: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getAppInfo: vi.fn().mockResolvedValue({ ok: true, value: { name: "Relic", platform: "darwin", version: "0.0.0" } }),
    getEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: defaultEditorSettings }),
    getWorkspaceTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceState: vi.fn().mockResolvedValue({
      ok: true,
      value: { activeWorkspace: null, fileTree: [], workspaces: [] }
    }),
    moveItemToTrash: vi.fn(),
    openWorkspace: vi.fn(),
    readMarkdownFile: vi.fn(),
    renameMarkdownFile: vi.fn(),
    renameFolder: vi.fn(),
    saveEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    switchWorkspace: vi.fn(),
    writeMarkdownFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  } as typeof window.relic;
}

const withWorkspace = {
  activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
  fileTree: [],
  workspaces: []
};

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
