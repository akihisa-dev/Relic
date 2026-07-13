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
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";
import { useEditorStore } from "./store/editorStore";

describe("App external file changes", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("現在のワークスペースを長時間監視できない場合だけ通知する", async () => {
    let watcherStatus: Parameters<NonNullable<typeof window.relic>["onWorkspaceWatcherStatus"]>[0] = () => undefined;
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      onWorkspaceWatcherStatus: vi.fn((callback) => {
        watcherStatus = callback;
        return vi.fn();
      })
    });

    await renderApp();
    await waitFor(() => expect(window.relic?.onWorkspaceWatcherStatus).toHaveBeenCalled());

    act(() => {
      watcherStatus({ changedAt: new Date().toISOString(), status: "unavailable", workspaceId: "ws-2" });
    });
    expect(screen.queryByText(/ワークスペースの変更を監視できません/)).toBeNull();

    act(() => {
      watcherStatus({ changedAt: new Date().toISOString(), status: "unavailable", workspaceId: "ws-1" });
    });
    expect(await screen.findByText(/ワークスペースの変更を監視できません/)).toHaveClass("toast--error");
  });

  it("未編集の開きタブは外部変更を自動反映する", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] = () => undefined;
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部変更前", name: "読書メモ", path: "読書メモ.md" }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部で更新された本文", name: "読書メモ", path: "読書メモ.md" }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      readMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));

    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());
    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    act(() => {
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" });
    });

    await waitFor(() => {
      const tab = useEditorStore.getState().tabs[activeTabId];
      expect(tab?.kind).toBe("file");
      if (tab?.kind === "file") {
        expect(tab.content).toBe("外部で更新された本文");
        expect(tab.savedContent).toBe("外部で更新された本文");
        expect(tab.externalConflict).toBeUndefined();
      }
    });
  });

  it("編集中の開きタブは外部変更と衝突させ自動保存を止める", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] = () => undefined;
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部変更前", name: "読書メモ", path: "読書メモ.md" }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部で更新された本文", name: "読書メモ", path: "読書メモ.md" }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      readMarkdownFile,
      writeMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "Relic側の編集中本文");
    });
    act(() => {
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" });
    });

    expect(await screen.findByText("このファイルは外部で変更されました。自動保存を一時停止しています。")).toBeInTheDocument();
    expect(await screen.findByText("読書メモ は外部で変更されたため、自動保存を一時停止しました。")).toHaveClass("toast--error");
    expect(writeMarkdownFile).not.toHaveBeenCalled();

    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") {
      expect(tab.content).toBe("Relic側の編集中本文");
      expect(tab.savedContent).toBe("外部変更前");
      expect(tab.externalConflict?.content).toBe("外部で更新された本文");
    }
  });

  it("エディタ入力直後の外部変更でもRelic側本文を残して衝突させる", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] = () => undefined;
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部変更前", name: "読書メモ", path: "読書メモ.md" }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部で更新された本文", name: "読書メモ", path: "読書メモ.md" }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      readMarkdownFile,
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
        changes: { from: view!.state.doc.length, insert: "\nRelic側の入力直後本文" }
      });
    });
    act(() => {
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" });
    });

    expect(await screen.findByText("このファイルは外部で変更されました。自動保存を一時停止しています。")).toBeInTheDocument();
    expect(await screen.findByText("読書メモ は外部で変更されたため、自動保存を一時停止しました。")).toHaveClass("toast--error");
    expect(writeMarkdownFile).not.toHaveBeenCalled();

    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") {
      expect(tab.content).toBe("外部変更前\nRelic側の入力直後本文");
      expect(tab.savedContent).toBe("外部変更前");
      expect(tab.externalConflict?.content).toBe("外部で更新された本文");
    }
  });

  it("外部更新で消えた未保存タブは閉じず本文を残す", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] = () => undefined;
    const getWorkspaceState = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: []
        }
      });

    window.relic = makeRelicApi({
      getWorkspaceState,
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "外部変更前", name: "読書メモ", path: "読書メモ.md" }
      }),
      writeMarkdownFile: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" }
      })
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "Relic側に残す未保存本文");
    });
    act(() => {
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" });
    });

    expect(await screen.findByText("読書メモ は外部で移動または削除されたため、未保存本文を開いたまま保持しました。")).toHaveClass("toast--error");

    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") {
      expect(tab.content).toBe("Relic側に残す未保存本文");
      expect(tab.savedContent).toBe("外部変更前");
    }
    expect(useEditorStore.getState().leftPane.activeTabId).toBe(activeTabId);
  });

  it("衝突通知帯から外部版を読み込める", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] = () => undefined;
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部変更前", name: "読書メモ", path: "読書メモ.md" }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部で更新された本文", name: "読書メモ", path: "読書メモ.md" }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      readMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "Relic側の編集中本文");
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" });
    });

    fireEvent.click(await screen.findByRole("button", { name: "外部版を読み込む" }));

    await waitFor(() => {
      const tab = useEditorStore.getState().tabs[activeTabId];
      expect(tab?.kind).toBe("file");
      if (tab?.kind === "file") {
        expect(tab.content).toBe("外部で更新された本文");
        expect(tab.savedContent).toBe("外部で更新された本文");
        expect(tab.externalConflict).toBeUndefined();
      }
    });
    expect(screen.queryByText("このファイルは外部で変更されました。自動保存を一時停止しています。")).not.toBeInTheDocument();
  });

  it("衝突通知帯からRelic版を保存し失敗時は衝突を維持する", async () => {
    let workspaceChanged: Parameters<NonNullable<typeof window.relic>["onWorkspaceChanged"]>[0] = () => undefined;
    const writeMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "FILE_WRITE_FAILED", message: "ファイルを保存できませんでした。" }
      })
      .mockResolvedValueOnce({ ok: true, value: undefined });
    const readMarkdownFile = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部変更前", name: "読書メモ", path: "読書メモ.md" }
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { content: "外部で更新された本文", name: "読書メモ", path: "読書メモ.md" }
      });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      onWorkspaceChanged: vi.fn((callback) => {
        workspaceChanged = callback;
        return vi.fn();
      }),
      readMarkdownFile,
      writeMarkdownFile
    });

    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;

    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "Relic側の編集中本文");
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1" });
    });

    fireEvent.click(await screen.findByRole("button", { name: "Relic版を保存" }));

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "Relic側の編集中本文",
      path: "読書メモ.md"
    }));
    expect(await screen.findByText("ファイルを保存できませんでした。")).toHaveClass("toast--error");
    expect(screen.getByText("このファイルは外部で変更されました。自動保存を一時停止しています。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Relic版を保存" }));

    await waitFor(() => {
      const tab = useEditorStore.getState().tabs[activeTabId];
      expect(tab?.kind).toBe("file");
      if (tab?.kind === "file") {
        expect(tab.content).toBe("Relic側の編集中本文");
        expect(tab.savedContent).toBe("Relic側の編集中本文");
        expect(tab.externalConflict).toBeUndefined();
      }
    });
    expect(screen.queryByText("このファイルは外部で変更されました。自動保存を一時停止しています。")).not.toBeInTheDocument();
  });

  it("ファイルツリーで開いているノートを再選択するとタブをアクティブにする", async () => {
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

    const fileButton = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.click(fileButton);
    expect(fileButton).toHaveClass("file-tree-row--opening");
    expect(container.querySelector(".rail-tab-flight--open")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });
    const openedTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(fileButton).not.toHaveClass("selected");
    expect(fileButton).not.toHaveClass("open");

    fireEvent.click(fileButton);
    expect(fileButton).toHaveClass("file-tree-row--opening");
    expect(container.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBe(openedTabId);
    });
    expect(fileButton).not.toHaveClass("selected");
    expect(fileButton).not.toHaveClass("open");
  });

  it("ファイルタブを閉じるとその場で静かに退場する", async () => {
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
    const tab = (await screen.findByText("読書メモ", { selector: ".pane-tab-name" })).closest(".pane-tab");
    expect(tab).toBeInstanceOf(HTMLElement);

    fireEvent.click(within(tab as HTMLElement).getByTitle("タブを閉じる"));

    await waitFor(() => {
      expect(container.querySelector(".pane-tab--closing")).toBeInTheDocument();
    });
    expect(container.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".pane-tab--closing")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBeNull();
    });
  });

  it("ファイル以外のタブを閉じても同じ退場反応を通る", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");
    fireEvent.click(screen.getByRole("button", { name: "設定" }));

    const tab = container.querySelector('.pane-tab[data-tab-id="panel-settings"]');
    expect(tab).toBeInstanceOf(HTMLElement);

    fireEvent.click(within(tab as HTMLElement).getByTitle("タブを閉じる"));

    await waitFor(() => {
      expect(container.querySelector(".pane-tab--closing")).toBeInTheDocument();
    });
    expect(container.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".pane-tab--closing")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useEditorStore.getState().tabs["panel-settings"]).toBeUndefined();
    });
  });

  it("ファイル読み込み完了前に再クリックすると開く操作を取り消す", async () => {
    let resolveRead: (value: Awaited<ReturnType<NonNullable<typeof window.relic>["readMarkdownFile"]>>) => void = () => {};
    const readMarkdownFile = vi.fn().mockReturnValue(new Promise((resolve) => {
      resolveRead = resolve;
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

    const fileButton = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.click(fileButton);
    fireEvent.click(fileButton);

    resolveRead({
      ok: true,
      value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
    });

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();

    expect(useEditorStore.getState().leftPane.activeTabId).toBeNull();
  });

  it("複数ファイルを開いた後でもファイルツリー再クリックで対象タブをアクティブにする", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "日記", path: "日記.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile: vi.fn().mockImplementation(({ path }: { path: string }) => Promise.resolve({
        ok: true,
        value: { content: "本文テスト", name: path.replace(/\.md$/, ""), path }
      }))
    });

    await renderApp();

    const firstFileButton = await screen.findByRole("button", { name: /読書メモ/ });
    const secondFileButton = await screen.findByRole("button", { name: /日記/ });

    fireEvent.click(firstFileButton);
    await waitFor(() => {
      expect(Object.values(useEditorStore.getState().tabs).some((tab) => tab.kind === "file" && tab.path === "読書メモ.md")).toBe(true);
    });

    fireEvent.click(secondFileButton);
    await waitFor(() => {
      expect(Object.values(useEditorStore.getState().tabs).some((tab) => tab.kind === "file" && tab.path === "日記.md")).toBe(true);
    });

    fireEvent.click(firstFileButton);

    const state = useEditorStore.getState();
    const firstTabId = Object.values(state.tabs).find((tab) => tab.kind === "file" && tab.path === "読書メモ.md")?.id;
    expect(firstTabId).toBeTruthy();
    expect(state.leftPane.activeTabId).toBe(firstTabId);
    expect(Object.values(useEditorStore.getState().tabs).some((tab) => tab.kind === "file" && tab.path === "日記.md")).toBe(true);
  });
});
