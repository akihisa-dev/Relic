import {
  act,
  fireEvent,
  screen,
  waitFor,
  within
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
import {
  renderApp,
  restoreNavigatorPlatform,
  setNavigatorPlatform
} from "./appTestHelpers";
import type { WindowCloseRequestEvent } from "../shared/ipc";
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

  it("大きいMarkdownを開くと性能優先のソース表示をtoastで通知する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "大容量メモ", path: "大容量メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: `**large**\n${"a".repeat(80_001)}`,
          name: "大容量メモ",
          path: "大容量メモ.md"
        }
      })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /大容量メモ/ }));

    expect(await screen.findByText("大容量メモ は大きいMarkdownのため、性能優先でソース表示にしました。")).toHaveClass("toast--info");
    expect(screen.getByText("大きいMarkdownのため、ライブプレビューを一時停止中です。")).toBeInTheDocument();
    expect(document.querySelector(".cm-live-bold")).toBeNull();
  });

  it("1万行Markdownへ入力してもEditorViewとカーソルとスクロール位置を維持する", async () => {
    const longMarkdown = Array.from({ length: 10_000 }, (_, index) => `行${index + 1} 本文`).join("\n");

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "長文メモ", path: "長文メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: longMarkdown, name: "長文メモ", path: "長文メモ.md" }
      })
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /長文メモ/ }));

    const editorContent = await waitFor(() => {
      const element = container.querySelector(".cm-content");
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });

    const view = EditorView.findFromDOM(editorContent);
    expect(view).not.toBeNull();
    expect(screen.queryByText("大きいMarkdownのため、ライブプレビューを一時停止中です。")).toBeNull();

    view!.scrollDOM.scrollTop = 2400;
    view!.scrollDOM.scrollLeft = 32;

    const insertAt = view!.state.doc.length;
    act(() => {
      view!.dispatch({
        changes: { from: insertAt, insert: "\n入力しても位置を維持" },
        selection: { anchor: insertAt + "\n入力しても位置を維持".length }
      });
    });

    const nextEditorContent = container.querySelector(".cm-content") as HTMLElement;
    const nextView = EditorView.findFromDOM(nextEditorContent);
    expect(nextView).toBe(view);
    expect(nextView!.state.selection.main.head).toBe(insertAt + "\n入力しても位置を維持".length);
    expect(nextView!.scrollDOM.scrollTop).toBe(2400);
    expect(nextView!.scrollDOM.scrollLeft).toBe(32);

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).not.toBeNull();
    const activeTab = useEditorStore.getState().tabs[activeTabId!];
    expect(activeTab?.kind).toBe("file");
    if (activeTab?.kind === "file") expect(activeTab.content).toBe(`${longMarkdown}\n入力しても位置を維持`);
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

    await renderApp();

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
      expectedContent: "本文テスト",
      path: "読書メモ.md"
    }), { timeout: 2000 });

    expect(await screen.findByText("ファイルを保存できませんでした。")).toHaveClass("toast--error");
    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") expect(tab.content).toBe("保存に失敗しても残る本文");
  });

  it("Diagram画面でNodeを移動すると図解Markdownを自動保存する", async () => {
    const diagramContent = [
      "---",
      "type: diagram",
      "title: 関係図",
      "---",
      "",
      "nodes:",
      "  - id: node-1",
      "    shape: process",
      "    text: alice",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "lines: []",
      ""
    ].join("\n");
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "関係図", path: "関係図.md", type: "file" }],
          fileIndex: [{
            contentHash: "diagram",
            diagramType: "diagram",
            excerptLines: [],
            kind: "diagram",
            mtimeMs: 1,
            name: "関係図",
            path: "関係図.md",
            size: diagramContent.length
          }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: diagramContent, name: "関係図", path: "関係図.md" }
      }),
      writeMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /関係図/ }));

    await screen.findByText("alice");
    const nodeCard = diagramNode("alice");
    expect(nodeCard).toBeInstanceOf(HTMLElement);

    fireEvent(nodeCard as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(nodeCard as HTMLElement, pointerEvent("pointermove", 1, 50, 30));
    fireEvent(nodeCard as HTMLElement, pointerEvent("pointerup", 1, 50, 30));

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: expect.stringContaining("x: 152"),
      expectedContent: diagramContent,
      path: "関係図.md"
    }), { timeout: 2000 });
  });

  it("保存後に図解ファイルの分類を更新してDiagramサイドバーへ表示する", async () => {
    const diagramContent = [
      "---",
      "type: diagram",
      "title: 関係図 6",
      "---",
      "",
      "nodes:",
      "  - id: node-1",
      "    shape: process",
      "    text: alice",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "lines: []",
      ""
    ].join("\n");
    const getWorkspaceState = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "関係図 6", path: "関係図 6.md", type: "file" }],
          fileIndex: [{
            excerptLines: [],
            kind: "markdown",
            mtimeMs: 1,
            name: "関係図 6",
            path: "関係図 6.md",
            readStatus: "ok",
            size: diagramContent.length
          }]
        }
      })
      .mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "関係図 6", path: "関係図 6.md", type: "file" }],
          fileIndex: [{
            excerptLines: [],
            kind: "diagram",
            mtimeMs: 2,
            name: "関係図 6",
            path: "関係図 6.md",
            readStatus: "ok",
            size: diagramContent.length + 1
          }]
        }
      });
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceState,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: diagramContent, name: "関係図 6", path: "関係図 6.md" }
      }),
      writeMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /関係図 6/ }));
    fireEvent.click(await screen.findByRole("button", { name: "図解" }));

    expect(await screen.findByText("図解ファイルはまだありません。")).toBeInTheDocument();

    await screen.findByText("alice");
    const nodeCard = diagramNode("alice");
    expect(nodeCard).toBeInstanceOf(HTMLElement);

    fireEvent(nodeCard as HTMLElement, pointerEvent("pointerdown", 1, 10, 10));
    fireEvent(nodeCard as HTMLElement, pointerEvent("pointermove", 1, 50, 30));
    fireEvent(nodeCard as HTMLElement, pointerEvent("pointerup", 1, 50, 30));

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: expect.stringContaining("x: 152"),
      expectedContent: diagramContent,
      path: "関係図 6.md"
    }), { timeout: 2000 });
    await waitFor(() => expect(getWorkspaceState).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.queryByText("図解ファイルはまだありません。")).not.toBeInTheDocument();
      expect(document.querySelector(".diagram-sidebar-file-list")).toHaveTextContent("関係図 6");
    });
  });

  it("Diagramサイドバーから作成した図解ファイルへ初期本文を書き込んで開く", async () => {
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const getWorkspaceState = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [],
          fileIndex: []
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "図解ファイル", path: "図解ファイル.md", type: "file" }],
          fileIndex: [{
            contentHash: "diagram",
            diagramType: "diagram",
            excerptLines: [],
            kind: "diagram",
            mtimeMs: 1,
            name: "図解ファイル",
            path: "図解ファイル.md",
            size: 1
          }]
        }
      });

    window.relic = makeRelicApi({
      createMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "図解ファイル", path: "図解ファイル.md", type: "file" }],
          fileIndex: []
        }
      }),
      getWorkspaceState,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: [
            "---",
            "type: diagram",
            "title: 図解ファイル",
            "---",
            "",
            "nodes: []",
            "lines: []",
            ""
          ].join("\n"),
          name: "図解ファイル",
          path: "図解ファイル.md"
        }
      }),
      writeMarkdownFile
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "図解" }));
    fireEvent.click(await screen.findByRole("button", { name: "図解ファイルを作成" }));

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: expect.stringContaining("type: diagram"),
      expectedContent: "",
      path: "図解ファイル.md"
    }));
    expect(await screen.findByRole("img", { name: "図解ファイル" })).toBeInTheDocument();
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
      expectedContent: "本文テスト",
      path: "読書メモ.md"
    }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).toBeNull());
  });

  it("エディタ入力直後にタブを閉じても最新本文を即時保存する", async () => {
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

    const { container } = await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();

    const view = EditorView.findFromDOM(editorContent as HTMLElement);
    expect(view).not.toBeNull();

    act(() => {
      view!.dispatch({
        changes: { from: view!.state.doc.length, insert: "\n入力直後の本文" }
      });
    });

    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    fireEvent.click(within(tab as HTMLElement).getByTitle("タブを閉じる"));

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "本文テスト\n入力直後の本文",
      expectedContent: "本文テスト",
      path: "読書メモ.md"
    }));
    await waitFor(() => expect(useEditorStore.getState().tabs[activeTabId]).toBeUndefined());
  });

  it("エディタ入力直後に別タブへ切り替えて戻っても本文を保持する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "作業メモ", path: "作業メモ.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile: vi.fn().mockImplementation(({ path }: { path: string }) => Promise.resolve({
        ok: true,
        value: path === "読書メモ.md"
          ? { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
          : { content: "作業本文", name: "作業メモ", path: "作業メモ.md" }
      }))
    });

    const { container } = await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());
    const firstTabId = useEditorStore.getState().leftPane.activeTabId!;

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();

    const view = EditorView.findFromDOM(editorContent as HTMLElement);
    expect(view).not.toBeNull();

    act(() => {
      view!.dispatch({
        changes: { from: view!.state.doc.length, insert: "\n切替直前の本文" }
      });
    });

    fireEvent.click(await screen.findByRole("button", { name: /作業メモ/ }));
    await waitFor(() => {
      const activeTab = useEditorStore.getState().tabs[useEditorStore.getState().leftPane.activeTabId ?? ""];
      expect(activeTab?.kind).toBe("file");
      if (activeTab?.kind === "file") expect(activeTab.path).toBe("作業メモ.md");
    });

    fireEvent.click(await screen.findByText("読書メモ", { selector: ".pane-tab-name" }));

    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).toBe(firstTabId));
    await waitFor(() => expect(container.querySelector(".cm-content")).toHaveTextContent("本文テスト"));
    expect(container.querySelector(".cm-content")).toHaveTextContent("切替直前の本文");
    const firstTab = useEditorStore.getState().tabs[firstTabId];
    expect(firstTab?.kind).toBe("file");
    if (firstTab?.kind === "file") expect(firstTab.content).toBe("本文テスト\n切替直前の本文");
  });

  it("エディタ入力直後にウィンドウを閉じても最新本文を保存してから閉じる", async () => {
    let closeRequestHandler: (event: WindowCloseRequestEvent) => void = () => {
      throw new Error("close request handler was not registered");
    };
    const respondToWindowCloseRequest = vi.fn();
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      onWindowCloseRequested: vi.fn((callback) => {
        closeRequestHandler = callback;
        return vi.fn();
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
      }),
      respondToWindowCloseRequest,
      writeMarkdownFile
    });

    const { container } = await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const editorContent = container.querySelector(".cm-content");
    expect(editorContent).not.toBeNull();

    const view = EditorView.findFromDOM(editorContent as HTMLElement);
    expect(view).not.toBeNull();

    act(() => {
      view!.dispatch({
        changes: { from: view!.state.doc.length, insert: "\n終了直前の本文" }
      });
    });

    closeRequestHandler({ requestId: "close-after-input" });

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "本文テスト\n終了直前の本文",
      expectedContent: "本文テスト",
      path: "読書メモ.md"
    }));
    await waitFor(() => expect(respondToWindowCloseRequest).toHaveBeenCalledWith({
      ok: true,
      requestId: "close-after-input"
    }));
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

function pointerEvent(type: string, pointerId: number, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY
  });

  Object.defineProperty(event, "pointerId", { value: pointerId });

  return event;
}

function diagramNode(title: string): HTMLElement {
  const node = Array.from(document.querySelectorAll<HTMLElement>(".diagram-canvas-node"))
    .find((candidate) => candidate.title === title);
  expect(node).toBeInstanceOf(HTMLElement);

  return node as HTMLElement;
}
