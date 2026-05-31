import {
  act,
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

describe("App file tabs", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
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

  it("Mermaid/D2図ブロックは表示され、図編集入口は出さない", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "設定", path: "設定.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: [
            "```mermaid",
            "flowchart TD",
            "  node1[人物]",
            "```",
            "",
            "```d2",
            "node1 -> node2",
            "```"
          ].join("\n"),
          name: "設定",
          path: "設定.md"
        }
      })
    });

    const { container } = await renderApp();

    await screen.findByText("設定", { selector: ".file-tree-name" });
    fireEvent.click(container.querySelector('[data-node-path="設定.md"]') as Element);
    expect(await screen.findByText("設定", { selector: ".pane-tab-name" })).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Mermaid編集" })).toBeNull();

    await waitFor(() => expect(container.querySelectorAll(".cm-live-diagram")).toHaveLength(2));
    expect(container.querySelector(".cm-live-diagram-edit-button")?.textContent).toBe("ソースを編集");
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
    expect(await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).toBeInTheDocument();
  });

  it("タブの右クリックメニューから複製・ピン留め・コピー・場所表示を実行する", async () => {
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
    const revealWorkspaceItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
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
      }),
      revealWorkspaceItem
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    expect(tab).not.toBeNull();

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "Markdownリンクをコピー" }));
    expect(writeText).toHaveBeenCalledWith("[[読書メモ]]");

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "複製" }));
    await waitFor(() => {
      expect(duplicateMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "ピン留め" }));
    fireEvent.contextMenu(tab!);
    expect(await screen.findByRole("button", { name: "ピン留めを解除" })).toBeInTheDocument();

    fireEvent.contextMenu(tab!);
    fireEvent.click(await screen.findByRole("button", { name: "ファイルの場所を表示" }));
    await waitFor(() => {
      expect(revealWorkspaceItem).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("右クリックメニューのMarkdownボタンを開いているタブへ反映する", async () => {
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

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();
    fireEvent.contextMenu(editorContent!, { clientX: 64, clientY: 64 });
    const editorMenu = await screen.findByRole("menu");
    fireEvent.click(within(editorMenu).getByRole("menuitem", { name: "太字" }));

    await waitFor(() => {
      const activeTabId = useEditorStore.getState().leftPane.activeTabId;
      expect(activeTabId).not.toBeNull();
      const tab = useEditorStore.getState().tabs[activeTabId!];
      expect(tab?.kind).toBe("file");
      if (tab?.kind === "file") expect(tab.content).toContain("**");
    });
  });

  it("自動保存に失敗した場合は本文を維持してエラーを表示する", async () => {
    const writeMarkdownFile = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" }
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
      writeMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "保存に失敗しても残る本文");
    });

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "保存に失敗しても残る本文",
      path: "読書メモ.md"
    }), { timeout: 2000 });

    expect(await screen.findByText("ファイルを保存できませんでした。")).toHaveClass("toast--error");
    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") expect(tab.content).toBe("保存に失敗しても残る本文");
  });

  it("ステータスバーに保存状態を表示する", async () => {
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

    expect(await screen.findByText("保存済み")).toBeInTheDocument();

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "未保存の本文");
    });

    expect(await screen.findByText("未保存")).toBeInTheDocument();
  });

  it("未保存タブを閉じる前に即時保存する", async () => {
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

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
      writeMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "閉じる前に保存する本文");
    });

    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    fireEvent.click(within(tab as HTMLElement).getByTitle("タブを閉じる"));

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "閉じる前に保存する本文",
      path: "読書メモ.md"
    }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).toBeNull());
  });

  it("閉じる前保存に失敗した場合はタブと本文を維持する", async () => {
    const writeMarkdownFile = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" }
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
      writeMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "保存できない本文");
    });

    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    fireEvent.click(within(tab as HTMLElement).getByTitle("タブを閉じる"));

    expect(await screen.findByText("ファイルを保存できませんでした。")).toHaveClass("toast--error");
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(activeTabId);
    const latestTab = useEditorStore.getState().tabs[activeTabId];
    expect(latestTab?.kind).toBe("file");
    if (latestTab?.kind === "file") expect(latestTab.content).toBe("保存できない本文");
  });
});
