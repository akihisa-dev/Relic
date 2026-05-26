import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { defaultEditorSettings, defaultFeatureToggles } from "../shared/ipc";
import {
  installMatchMediaMock,
  makeRelicApi,
  resetRendererStores,
  testWorkspaceState as withWorkspace
} from "../test/rendererTestUtils";
import { App } from "./App";
import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

function renderApp() {
  return render(<App />);
}

function searchResultSet(results: unknown[]) {
  return { results, skippedLargeFiles: 0, truncated: false };
}

describe("App", () => {
  beforeAll(installMatchMediaMock);

  afterEach(() => {
    vi.clearAllMocks();
    resetRendererStores();
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
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1", workspacePath: "/tmp/Notes" });
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
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1", workspacePath: "/tmp/Notes" });
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
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1", workspacePath: "/tmp/Notes" });
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
      workspaceChanged({ changedAt: new Date().toISOString(), workspaceId: "ws-1", workspacePath: "/tmp/Notes" });
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

    fireEvent.click(fileButton);
    expect(fileButton).toHaveClass("file-tree-row--opening");
    expect(container.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBe(openedTabId);
    });
  });

  it("ファイルタブを閉じるとその場で下へ消える表示を出す", async () => {
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
      expect(container.querySelector(".rail-tab-flight--close")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).toBeNull();
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

  it("右パネルのアウトライン・リンクボタンを閉じた後も再度開ける", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(true);
    expect(useUiStore.getState().rightPanelView).toBe("outline");
    expect(container.querySelector(".title-bar--right-panel-open .main-area-actions")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    expect(useUiStore.getState().isRightPanelOpen).toBe(false);
    expect(useUiStore.getState().rightPanelView).toBe("outline");

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

  it("右パネル幅のドラッグ変更を最小220px・最大520pxに制限する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");
    fireEvent.click(screen.getByRole("button", { name: "アウトライン" }));

    const rightPanel = container.querySelector(".right-panel");
    const resizeHandle = container.querySelector(".right-panel-resize-handle");

    expect(rightPanel).toBeInstanceOf(HTMLElement);
    expect(resizeHandle).toBeInstanceOf(HTMLElement);

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 500 });

    expect(rightPanel).toHaveClass("right-panel--resizing");
    expect(resizeHandle).toHaveClass("right-panel-resize-handle--active");

    fireEvent.mouseMove(document, { clientX: -100 });

    expect(rightPanel).toHaveStyle({ width: "520px" });

    fireEvent.mouseUp(document);

    expect(rightPanel).not.toHaveClass("right-panel--resizing");
    expect(resizeHandle).not.toHaveClass("right-panel-resize-handle--active");

    fireEvent.mouseDown(resizeHandle as HTMLElement, { clientX: 200 });
    fireEvent.mouseMove(document, { clientX: 900 });

    expect(rightPanel).toHaveStyle({ width: "220px" });

    fireEvent.mouseUp(document);
  });

  it("レールのフロントマターボタンから専用設定を開ける", async () => {
    window.relic = makeRelicApi({
      getUserDefinedFields: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ name: "category", type: "select", choices: ["draft", "done"] }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "フロントマター" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("panel-frontmatter");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      kind: "panel",
      panel: "frontmatter"
    });
    expect(document.querySelector('.pane-tab[data-tab-id="panel-frontmatter"] .pane-tab-icon svg')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "フロントマター" })).toHaveClass("active");
    expect(screen.getByText("フロントマター設定")).toBeInTheDocument();
    expect(screen.getByDisplayValue("category")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "フロントマター" }));

    expect(document.querySelector(".rail-tab-flight--close")).not.toBeInTheDocument();
    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-frontmatter");
    expect(useEditorStore.getState().tabs["panel-frontmatter"]).toBeDefined();
  });

  it("レールの暦設定ボタンから専用設定を開ける", async () => {
    window.relic = makeRelicApi({
      getWorkspaceChronicleCalendars: vi.fn().mockResolvedValue({
        ok: true,
        value: [
          { id: "chronicle0", name: "王国暦" },
          { id: "chronicle1", name: "帝国暦", startYear: 100 }
        ]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("panel-chronicleSettings");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      kind: "panel",
      panel: "chronicleSettings"
    });
    expect(screen.getByRole("button", { name: "暦設定" })).toHaveClass("active");
    expect(screen.getByDisplayValue("王国暦")).toBeInTheDocument();
    expect(screen.getByDisplayValue("帝国暦")).toBeInTheDocument();
    expect(screen.getByText("帝国暦1年 = 王国暦100年")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "暦設定" }));

    expect(useEditorStore.getState().leftPane.activeTabId).toBe("panel-chronicleSettings");
    expect(useEditorStore.getState().tabs["panel-chronicleSettings"]).toBeDefined();
  });

  it("レールのチャートボタンからchronicleを持つファイルを表示できる", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "1333",
            endValue: 1332,
            fileName: "鎌倉時代",
            path: "history/kamakura.md",
            startLabel: "1185",
            startValue: 1184
          }],
          filePaths: ["history/kamakura.md"],
          id: "chronicle",
          name: "年表",
          source: "chronicle"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nchronicle0: [1186, 1334]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const renderResult = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));

    const activeTabId = useEditorStore.getState().leftPane.activeTabId;
    expect(activeTabId).toBe("chart-chronicle");
    expect(useEditorStore.getState().tabs[activeTabId!]).toMatchObject({
      chartId: "chronicle",
      kind: "chart"
    });
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    expect(renderResult.container.querySelector(".chronicle-sidebar")).toBeNull();
    expect(screen.getAllByText("鎌倉時代").length).toBeGreaterThan(0);
    expect(screen.getByText("1185 〜 1333")).toBeInTheDocument();
    expect(screen.getByText("年代")).toBeInTheDocument();
    expect(screen.getByText("1185-1333")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1185-1333" })).toHaveAttribute(
      "title",
      "この年代へ移動"
    );
    expect(renderResult.container.querySelector(".chronicle-minimap")).toBeInTheDocument();
    expect(renderResult.container.querySelector(".chronicle-minimap-item")).toBeInTheDocument();
    expect(renderResult.container.querySelector(".chronicle-actions")).toBeNull();
    expect(screen.queryByText("計画")).not.toBeInTheDocument();
    expect(screen.queryByText("実行")).not.toBeInTheDocument();
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(0);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line--major").length).toBeGreaterThan(0);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(
      renderResult.container.querySelectorAll(".chronicle-guide-line--major").length
    );
    const oneYearAxisLabels = Array.from(renderResult.container.querySelectorAll(".chronicle-axis--chronicle .chronicle-axis-cell"))
      .map((element) => Number(element.textContent?.replace("−", "-") ?? Number.NaN));
    expect(oneYearAxisLabels.length).toBeGreaterThan(0);
    expect(oneYearAxisLabels.slice(1, 5).every((label, index) => label - oneYearAxisLabels[index] === 1)).toBe(true);
    expect(renderResult.container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(
      renderResult.container.querySelectorAll(".chronicle-guide-line--major").length
    );
    expect(renderResult.container.querySelectorAll(".chronicle-guide-row-line").length).toBeGreaterThan(0);

    const fill = renderResult.container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 20 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      endValue: 1333,
      kind: "move",
      originalEndValue: 1332,
      originalStartValue: 1184,
      path: "history/kamakura.md",
      source: "chronicle",
      startValue: 1185
    }));
  });

  it("chronicleチャートのバー編集は低速ドラッグで1年単位の細かな変更にする", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "1333",
            endValue: 1332,
            fileName: "鎌倉時代",
            path: "history/kamakura.md",
            startLabel: "1185",
            startValue: 1184
          }],
          filePaths: ["history/kamakura.md"],
          id: "chronicle",
          name: "年表",
          source: "chronicle"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nchronicle0: [1210, 1358]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    expect(container.querySelector(".chronicle-actions")).toBeNull();

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    for (let clientX = 1; clientX <= 72; clientX += 1) {
      const pointerMove = new Event("pointermove") as PointerEvent;
      Object.defineProperty(pointerMove, "clientX", { value: clientX });
      Object.defineProperty(pointerMove, "pointerId", { value: 1 });
      window.dispatchEvent(pointerMove);
    }
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 72 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      endValue: 1333,
      kind: "move",
      originalEndValue: 1332,
      originalStartValue: 1184,
      path: "history/kamakura.md",
      source: "chronicle",
      startValue: 1185
    }));
  });

  it("chronicleチャートのバー編集は高速ドラッグで大きく移動する", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({ ok: true, value: [] });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "1333",
            endValue: 1332,
            fileName: "鎌倉時代",
            path: "history/kamakura.md",
            startLabel: "1185",
            startValue: 1184
          }],
          filePaths: ["history/kamakura.md"],
          id: "chronicle",
          name: "年表",
          source: "chronicle"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nchronicle0: [1210, 1358]\n---\n# 鎌倉時代",
          name: "鎌倉時代",
          path: "history/kamakura.md"
        }
      }),
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));
    expect(container.querySelector(".chronicle-actions")).toBeNull();

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 72 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      endValue: 1335,
      kind: "move",
      originalEndValue: 1332,
      originalStartValue: 1184,
      path: "history/kamakura.md",
      source: "chronicle",
      startValue: 1187
    }));
  });

  it("dateチャートは表示対象が空でも日付チャートを表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "2026",
            endValue: 2025,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026",
            startValue: 2025
          }],
          filePaths: ["tasks/implementation.md"],
          id: "chronicle",
          name: "chronicle",
          source: "chronicle"
        }, {
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }, {
            dateKind: "actual",
            endLabel: "2026-05-06",
            endValue: 20579,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-03",
            startValue: 20576
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    expect(useEditorStore.getState().leftPane.activeTabId).toBe("chart-date");
    expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(1);
    expect(screen.getByText("計画")).toBeInTheDocument();
    expect(screen.getByText("実行")).toBeInTheDocument();
    expect(screen.queryByText("2026-05-01 〜 2026-05-05")).not.toBeInTheDocument();
    expect(screen.getByText("01 〜 05")).toBeInTheDocument();
    expect(screen.getByText("03 〜 06")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-axis--date .chronicle-axis-row")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(container.querySelector(".chronicle-chart")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-fill")).toHaveLength(2);
    expect(container.querySelector('.chronicle-fill[data-date-kind="planned"]')).toBeInTheDocument();
    expect(container.querySelector('.chronicle-fill[data-date-kind="actual"]')).toBeInTheDocument();
    expect(container.querySelector(".chronicle-minimap")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-minimap-item")).toHaveLength(2);
    expect(container.querySelector(".chronicle-today-line")).toBeInTheDocument();
    expect(container.querySelectorAll(".chronicle-guide-line").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chronicle-guide-line--major").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chronicle-guide-line--major").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".chronicle-guide-row-line").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "フロントマター" }));
    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    expect(screen.getByRole("button", { name: "カレンダー" })).toHaveClass("active");
    expect(container.querySelector('.chronicle-fill[data-date-kind="actual"]')).toBeInTheDocument();
  });

  it("チャート面を掴んで横スクロールできる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            endLabel: "2026-06-20",
            endValue: 20624,
            fileName: "長い予定",
            path: "tasks/long.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const chart = container.querySelector(".chronicle-chart") as HTMLDivElement;
    Object.defineProperty(chart, "scrollLeft", { configurable: true, value: 120, writable: true });

    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 200 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    chart.dispatchEvent(pointerDown);

    const pointerMove = new Event("pointermove") as PointerEvent;
    Object.defineProperty(pointerMove, "clientX", { value: 150 });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });
    window.dispatchEvent(pointerMove);

    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    expect(chart.scrollLeft).toBe(170);
  });

  it("main側がdate行を返さない場合もMarkdownからplannedDateとactualDateを補完する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "実装タスク", path: "tasks/implementation.md", type: "file" }]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          content: "---\nstatus: [進行中]\nplannedDate: [2026-05-01, 2026-05-05]\nactualDate: [2026-05-03, 2026-05-06]\n---\n# 実装タスク",
          name: "実装タスク",
          path: "tasks/implementation.md"
        }
      })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    await waitFor(() => expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(1));
    expect(screen.getByText("計画")).toBeInTheDocument();
    expect(screen.getByText("実行")).toBeInTheDocument();
    expect(container.querySelector('.chronicle-fill[data-date-kind="planned"]')).toBeInTheDocument();
    expect(container.querySelector('.chronicle-fill[data-date-kind="actual"]')).toBeInTheDocument();
    const plannedFill = container.querySelector('.chronicle-fill[data-date-kind="planned"]') as HTMLElement;
    const actualFill = container.querySelector('.chronicle-fill[data-date-kind="actual"]') as HTMLElement;
    expect(plannedFill.querySelector(".chronicle-fill-status")).toBeNull();
    const initialStatusLabel = actualFill.querySelector(".chronicle-fill-status") as HTMLElement;
    expect(initialStatusLabel).toHaveTextContent("進行中");
    expect(parseFloat(initialStatusLabel.style.width)).toBeLessThanOrEqual(parseFloat(actualFill.style.width));

    const initialStatusLeft = initialStatusLabel.style.left;
    expect(initialStatusLeft).not.toBe("");
  });

  it("main側がdate行を返さない場合も片方だけあるplannedDateまたはactualDateを補完する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "計画だけ", path: "tasks/planned-only.md", type: "file" },
            { name: "実行だけ", path: "tasks/actual-only.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile: vi.fn().mockImplementation(({ path }: { path: string }) => Promise.resolve({
        ok: true as const,
        value: {
          content: path === "tasks/actual-only.md"
            ? "---\nstatus: [完了]\nactualDate: [2026-05-03]\n---\n# 実行だけ"
            : "---\nstatus: [未着手]\nplannedDate: [2026-05-01]\n---\n# 計画だけ",
          name: path === "tasks/actual-only.md" ? "実行だけ" : "計画だけ",
          path
        }
      }))
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    await waitFor(() => expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(2));
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="planned"]')).toHaveLength(1);
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="actual"]')).toHaveLength(1);
    expect(container.querySelector('.chronicle-file-name[title="tasks/planned-only.md"]')).toHaveTextContent("計画だけ");
    expect(container.querySelector('.chronicle-file-name[title="tasks/actual-only.md"]')).toHaveTextContent("実行だけ");

    fireEvent.change(screen.getByLabelText("ステータス"), { target: { value: "完了" } });

    expect(container.querySelectorAll(".chronicle-file-name")).toHaveLength(1);
    expect(container.querySelector('.chronicle-file-name[title="tasks/planned-only.md"]')).not.toBeInTheDocument();
    expect(container.querySelector('.chronicle-file-name[title="tasks/actual-only.md"]')).toHaveTextContent("実行だけ");
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="planned"]')).toHaveLength(0);
    expect(container.querySelectorAll('.chronicle-fill[data-date-kind="actual"]')).toHaveLength(1);
  });

  it("チャートバーはクリックでファイルを開かずドラッグで日付範囲を更新する", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({
      ok: true,
      value: [{
        entries: [{
          dateKind: "planned",
          endLabel: "2026-05-06",
          endValue: 20579,
          fileName: "実装タスク",
          path: "tasks/implementation.md",
          startLabel: "2026-05-02",
          startValue: 20575
        }],
        filePaths: [],
        id: "date",
        name: "date",
        source: "date"
      }]
    });
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "---\nplannedDate: [2026-05-02, 2026-05-06]\n---\n# 実装タスク", name: "実装タスク", path: "tasks/implementation.md" }
    });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile,
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    fireEvent.click(fill);

    expect(readMarkdownFile).not.toHaveBeenCalled();

    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerMove = new Event("pointermove") as PointerEvent;
    Object.defineProperty(pointerMove, "clientX", { value: 15 });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });
    window.dispatchEvent(pointerMove);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 15 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(updateChartEntry).toHaveBeenCalledWith({
      endValue: 20579,
      kind: "move",
      originalEndValue: 20578,
      originalStartValue: 20574,
      path: "tasks/implementation.md",
      dateKind: "planned",
      source: "date",
      startValue: 20575
    }));
  });

  it("チャートバーの保存に失敗した場合はエラーを表示する", async () => {
    const updateChartEntry = vi.fn().mockResolvedValue({
      error: { code: "CHART_ENTRY_UPDATE_FAILED", message: "チャートの変更を保存できませんでした。" },
      ok: false
    });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      updateChartEntry
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 15 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    expect(await screen.findByText("チャートの変更を保存できませんでした。")).toHaveClass("toast--error");
  });

  it("チャート更新専用IPCが使えない場合も既存のファイル読み書きでバー変更を保存する", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "---\nchronicle0: [2026]\nplannedDate: [2026-05-01, 2026-05-05]\n---\n# 実装タスク",
        name: "実装タスク",
        path: "tasks/implementation.md"
      }
    });
    const writeMarkdownFile = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{
          entries: [{
            dateKind: "planned",
            endLabel: "2026-05-05",
            endValue: 20578,
            fileName: "実装タスク",
            path: "tasks/implementation.md",
            startLabel: "2026-05-01",
            startValue: 20574
          }],
          filePaths: [],
          id: "date",
          name: "date",
          source: "date"
        }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      readMarkdownFile,
      updateChartEntry: undefined,
      writeMarkdownFile
    } as Partial<typeof window.relic>);

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "カレンダー" }));

    const fill = container.querySelector(".chronicle-fill") as HTMLElement;
    const pointerDown = new Event("pointerdown", { bubbles: true }) as PointerEvent;
    Object.defineProperty(pointerDown, "button", { value: 0 });
    Object.defineProperty(pointerDown, "clientX", { value: 0 });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    fill.dispatchEvent(pointerDown);
    const pointerUp = new Event("pointerup") as PointerEvent;
    Object.defineProperty(pointerUp, "clientX", { value: 15 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });
    window.dispatchEvent(pointerUp);

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "---\nchronicle0: [2026]\nplannedDate: [2026-05-02, 2026-05-06]\n---\n# 実装タスク",
      path: "tasks/implementation.md"
    }));
  });

  it("旧形式の年表データが返っても年表タブを表示できる", async () => {
    window.relic = makeRelicApi({
      getWorkspaceCharts: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ endYear: 1333, fileName: "鎌倉時代", path: "history/kamakura.md", startYear: 1185 }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    const { container } = await renderApp();

    await screen.findByText("Notes");

    fireEvent.click(screen.getByRole("button", { name: "年表" }));

    expect(screen.getAllByText("鎌倉時代").length).toBeGreaterThan(0);
    expect(screen.getByText("1185 〜 1333")).toBeInTheDocument();
  });

  it("画面タブ名は言語変更に追従する", async () => {
    window.relic = makeRelicApi({
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

    expect(document.querySelector(".rail-tab-flight--open")).toBeInTheDocument();
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

  it("本文上部のファイル名は本文外の表示として出し、直接リネームできる", async () => {
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

    const title = await screen.findByText("読書メモ", { selector: ".editor-file-title" });
    expect(title).toBeInTheDocument();
    expect(container.querySelector(".cm-content")).toHaveTextContent("本文テスト");
    expect(container.querySelector(".cm-content")).not.toHaveTextContent("読書メモ");

    fireEvent.click(title);
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("未保存の開きタブはリネーム前に即時保存する", async () => {
    const renameMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "未保存本文", name: "読書ログ", path: "読書ログ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [{ name: "読書ログ", path: "読書ログ.md", type: "file" }]
        }
      }
    });
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
      renameMarkdownFile,
      writeMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "未保存本文");
    });

    fireEvent.click(await screen.findByText("読書メモ", { selector: ".editor-file-title" }));
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    await waitFor(() => expect(writeMarkdownFile).toHaveBeenCalledWith({
      content: "未保存本文",
      path: "読書メモ.md"
    }));
    await waitFor(() => {
      expect(renameMarkdownFile).toHaveBeenCalledWith({ newName: "読書ログ", path: "読書メモ.md" });
    });
  });

  it("リネーム前保存に失敗した場合は操作せず本文を残す", async () => {
    const renameMarkdownFile = vi.fn();
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
      renameMarkdownFile,
      writeMarkdownFile
    });

    const { container } = await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull());

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "未保存本文");
    });

    fireEvent.click(await screen.findByText("読書メモ", { selector: ".editor-file-title" }));
    fireEvent.change(container.querySelector(".editor-file-title-input") as HTMLInputElement, {
      target: { value: "読書ログ" }
    });
    fireEvent.submit(container.querySelector(".editor-file-title-form") as HTMLFormElement);

    expect(await screen.findByText("ファイルを保存できませんでした。")).toHaveClass("toast--error");
    expect(renameMarkdownFile).not.toHaveBeenCalled();
    const tab = useEditorStore.getState().tabs[activeTabId];
    expect(tab?.kind).toBe("file");
    if (tab?.kind === "file") expect(tab.content).toBe("未保存本文");
  });

  it("リンク更新影響が大きいリネームは確認し、キャンセル時は操作しない", async () => {
    const renameMarkdownFile = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    window.relic = makeRelicApi({
      getLinkUpdateImpact: vi.fn().mockResolvedValue({ ok: true, value: { fileCount: 31, linkCount: 100 } }),
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
      expect(confirmSpy).toHaveBeenCalledWith("31 件のMarkdownファイル内にある 100 件のリンクを更新します。続けますか？");
    });
    expect(renameMarkdownFile).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
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

  it("ファイルツリーの右クリックメニューから開く・ピン留め・パスコピーを実行する", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "本文テスト", name: "読書メモ", path: "読書メモ.md" }
    });
    const togglePin = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }],
        pinnedPaths: ["読書メモ.md"]
      }
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [{ name: "読書メモ", path: "読書メモ.md", type: "file" }]
        }
      }),
      readMarkdownFile,
      togglePin
    });

    await renderApp();

    const fileRow = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.contextMenu(fileRow);

    expect(await screen.findByRole("menuitem", { name: "開く" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "ピン留め" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "パスをコピー" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: "パスをコピー" }));

    expect(writeText).toHaveBeenCalledWith("読書メモ.md");

    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ピン留め" }));

    await waitFor(() => {
      expect(togglePin).toHaveBeenCalledWith("読書メモ.md");
    });

    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "開く" }));

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
    });
  });

  it("ファイルツリーの右クリックメニューから作成・移動・Markdownリンクコピー・場所表示を実行する", async () => {
    const createLinkedMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "", name: "新規メモ", path: "資料/新規メモ.md" },
        workspaceState: {
          ...withWorkspace,
          fileTree: [
            {
              children: [{ name: "新規メモ", path: "資料/新規メモ.md", type: "file" }],
              name: "資料",
              path: "資料",
              type: "folder"
            }
          ]
        }
      }
    });
    const createFolder = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        ...withWorkspace,
        fileTree: [
          {
            children: [
              { children: [], name: "下書き", path: "資料/下書き", type: "folder" },
              { name: "読書メモ", path: "資料/読書メモ.md", type: "file" }
            ],
            name: "資料",
            path: "資料",
            type: "folder"
          }
        ]
      }
    });
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "本文", name: "読書メモ", path: "archive/読書メモ.md" },
        workspaceState: withWorkspace
      }
    });
    const revealWorkspaceItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    const promptSpy = vi.spyOn(window, "prompt");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      createFolder,
      createLinkedMarkdownFile,
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
      }),
      moveMarkdownFile,
      revealWorkspaceItem
    });

    await renderApp();

    const folderRow = await screen.findByRole("button", { name: /資料/ });
    promptSpy.mockReturnValueOnce("新規メモ");
    fireEvent.contextMenu(folderRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ここに新規ファイル" }));
    await waitFor(() => {
      expect(createLinkedMarkdownFile).toHaveBeenCalledWith({ path: "資料/新規メモ.md" });
    });

    promptSpy.mockReturnValueOnce("下書き");
    fireEvent.contextMenu(folderRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ここにフォルダ作成" }));
    await waitFor(() => {
      expect(createFolder).toHaveBeenCalledWith({ name: "下書き", parentFolder: "資料" });
    });

    const fileRow = await screen.findByRole("button", { name: /読書メモ/ });
    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "Markdownリンクをコピー" }));
    expect(writeText).toHaveBeenCalledWith("[[資料/読書メモ]]");

    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "ファイルの場所を表示" }));
    await waitFor(() => {
      expect(revealWorkspaceItem).toHaveBeenCalledWith({ path: "資料/読書メモ.md" });
    });

    promptSpy.mockReturnValueOnce("archive");
    fireEvent.contextMenu(fileRow);
    fireEvent.click(await screen.findByRole("menuitem", { name: "移動…" }));
    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({
        destinationFolder: "archive",
        path: "資料/読書メモ.md"
      });
    });

    promptSpy.mockRestore();
  });

  it("ファイルツリーの右クリックメニューを画面基準で表示する", async () => {
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

    fireEvent.contextMenu(await screen.findByRole("button", { name: /読書メモ/ }), {
      clientX: 490,
      clientY: 1040
    });

    const menu = await screen.findByRole("menu");

    expect(menu).toHaveClass("file-tree-context-menu");
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ position: "fixed" });
    expect(Number.parseInt((menu as HTMLElement).style.left, 10)).toBeGreaterThan(0);
    expect(Number.parseInt((menu as HTMLElement).style.top, 10)).toBeGreaterThan(0);
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

  it("ファイルとフォルダはフォルダ行へのドラッグ&ドロップで移動できる", async () => {
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

  it("展開済みフォルダ内の余白へドロップしても移動しない", async () => {
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: withWorkspace
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            {
              children: [{ name: "old", path: "archive/old.md", type: "file" }],
              name: "archive",
              path: "archive",
              type: "folder"
            }
          ]
        }
      }),
      moveMarkdownFile
    });

    const { container } = await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const archiveTree = archiveRow.closest("li")?.querySelector("ul.file-tree");

    expect(archiveTree).not.toBeNull();

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(archiveTree).not.toHaveClass("file-tree--drag-over");

    fireEvent.drop(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(moveMarkdownFile).not.toHaveBeenCalled();
  });

  it("ファイル行へドロップするとそのファイルと同じ親フォルダへ移動する", async () => {
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: withWorkspace
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            {
              children: [{ name: "old", path: "archive/old.md", type: "file" }],
              name: "archive",
              path: "archive",
              type: "folder"
            }
          ]
        }
      }),
      moveMarkdownFile
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const oldRow = await screen.findByRole("button", { name: /old/ });

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(oldRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(oldRow).toHaveClass("drag-over");

    fireEvent.drop(oldRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
    });
  });

  it("空フォルダの内容エリアへドロップしても移動しない", async () => {
    const moveMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        file: { content: "# Note", name: "note", path: "archive/note.md" },
        workspaceState: withWorkspace
      }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "note", path: "note.md", type: "file" },
            { children: [], name: "archive", path: "archive", type: "folder" }
          ]
        }
      }),
      moveMarkdownFile
    });

    const { container } = await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const archiveTree = archiveRow.closest("li")?.querySelector("ul.file-tree");

    expect(archiveTree).not.toBeNull();

    fireEvent.dragStart(noteRow, {
      dataTransfer: { effectAllowed: "move", setData: vi.fn() }
    });
    fireEvent.dragOver(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(archiveTree).not.toHaveClass("file-tree--drag-over");

    fireEvent.drop(archiveTree ?? container, {
      dataTransfer: { getData: () => JSON.stringify({ path: "note.md", type: "file" }) }
    });

    expect(moveMarkdownFile).not.toHaveBeenCalled();
  });

  it("同じ親フォルダや子孫フォルダへはドラッグ移動しない", async () => {
    const moveFolder = vi.fn();
    const moveMarkdownFile = vi.fn();

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            {
              children: [
                { name: "note", path: "archive/note.md", type: "file" },
                {
                  children: [],
                  name: "child",
                  path: "archive/child",
                  type: "folder"
                }
              ],
              name: "archive",
              path: "archive",
              type: "folder"
            }
          ]
        }
      }),
      moveFolder,
      moveMarkdownFile
    });

    await renderApp();

    const archiveRow = await screen.findByRole("button", { name: /archive/ });
    const childRow = await screen.findByRole("button", { name: /child/ });

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "archive/note.md", type: "file" }) }
    });
    fireEvent.drop(childRow, {
      dataTransfer: { getData: () => JSON.stringify({ path: "archive", type: "folder" }) }
    });

    expect(moveMarkdownFile).not.toHaveBeenCalled();
    expect(moveFolder).not.toHaveBeenCalled();
  });

  it("ファイルとフォルダを複数選択できる", async () => {
    const readMarkdownFile = vi.fn().mockResolvedValue({
      ok: true,
      value: { content: "本文", name: "note", path: "note.md" }
    });

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
      readMarkdownFile
    });

    await renderApp();

    const noteRow = await screen.findByRole("button", { name: /note/ });
    const draftsRow = await screen.findByRole("button", { name: /drafts/ });
    const archiveRow = await screen.findByRole("button", { name: /archive/ });

    fireEvent.click(noteRow, { metaKey: true });
    fireEvent.click(draftsRow, { metaKey: true });

    expect(noteRow).toHaveClass("selected");
    expect(noteRow).toHaveClass("multi-selected");
    expect(draftsRow).toHaveClass("selected");
    expect(draftsRow).toHaveClass("multi-selected");
    expect(screen.getByText("2件選択中")).toBeInTheDocument();

    fireEvent.click(archiveRow, { shiftKey: true });

    expect(noteRow).not.toHaveClass("selected");
    expect(draftsRow).toHaveClass("selected");
    expect(draftsRow).toHaveClass("multi-selected");
    expect(archiveRow).toHaveClass("selected");
    expect(archiveRow).toHaveClass("multi-selected");
    expect(screen.getByText("2件選択中")).toBeInTheDocument();

    fireEvent.click(noteRow);

    expect(readMarkdownFile).not.toHaveBeenCalled();
  });

  it("複数選択したファイルとフォルダをドラッグ&ドロップでまとめて移動できる", async () => {
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
    const payload = setData.mock.calls[0]?.[1] as string | undefined;

    expect(payload).toBeDefined();

    fireEvent.drop(archiveRow, {
      dataTransfer: { getData: () => payload ?? "" }
    });

    await waitFor(() => {
      expect(moveMarkdownFile).toHaveBeenCalledWith({ destinationFolder: "archive", path: "note.md" });
    });
    await waitFor(() => {
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

  it("ファイルモードの検索方法ボタンで検索方法候補を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace })
    });

    await renderApp();

    fireEvent.focus(await screen.findByLabelText("ファイル検索"));

    expect(screen.queryByRole("option", { name: "全文" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));

    expect(await screen.findByRole("option", { name: "全文" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ファイル名" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "タグ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "プロパティ" })).toBeInTheDocument();
  });

  it("検索語句を入力すると検索結果を表示し、クリックでファイルを開く", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{
        fileName: "読書メモ",
        lineNumber: 3,
        lineText: "一致した行",
        path: "読書メモ.md"
      }])
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

    fireEvent.change(await screen.findByLabelText("ファイル検索"), {
      target: { value: "一致" }
    });

    expect(await screen.findByText("3: 一致した行")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /読書メモ/ }));

    expect(searchWorkspace).toHaveBeenCalledWith({ mode: "fullText", query: "一致" });
    expect(searchWorkspace.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "fullText", query: "一致" });
    expect(readMarkdownFile).toHaveBeenCalledWith({ path: "読書メモ.md" });
  });

  it("検索中は読み込み反応を表示する", async () => {
    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace: vi.fn().mockReturnValue(new Promise(() => undefined))
    });

    await renderApp();

    fireEvent.change(await screen.findByLabelText("ファイル検索"), {
      target: { value: "draft" }
    });

    const loading = await screen.findByText("読み込んでいます…");
    expect(loading).toHaveClass("list-loading-note");
  });

  it("検索方法でタグを選ぶとタグ検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "資料ノート", lineNumber: null, lineText: "#資料", path: "資料ノート.md" }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "タグ" }));
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "タグ" })).not.toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "資料" }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "tag", query: "資料" });
    });
    expect(searchWorkspace.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "tag", query: "資料" });
    expect((await screen.findAllByText("#資料")).length).toBeGreaterThan(0);
  });

  it("検索方法でファイル名を選ぶとファイル名検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "読書メモ", lineNumber: null, lineText: "読書メモ.md", path: "読書メモ.md" }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "ファイル名" }));
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "読書" }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "fileName", query: "読書" });
    });
    expect(searchWorkspace.mock.calls.at(-1)?.[0]).toStrictEqual({ mode: "fileName", query: "読書" });
    expect(await screen.findByText("読書メモ.md")).toBeInTheDocument();
  });

  it("検索方法で正規表現を選ぶと正規表現検索に切り替える", async () => {
    const searchWorkspace = vi.fn().mockResolvedValue({
      ok: true,
      value: searchResultSet([{ fileName: "読書メモ", lineNumber: 1, lineText: "# 読書メモ", path: "読書メモ.md" }])
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "正規表現" }));
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
      target: { value: "^# " }
    });

    await waitFor(() => {
      expect(searchWorkspace).toHaveBeenCalledWith({ mode: "regex", query: "^# " });
    });
    expect(await screen.findByText("1: # 読書メモ")).toBeInTheDocument();
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

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "正規表現" }));
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
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
      value: searchResultSet([{ fileName: "読書メモ", lineNumber: null, lineText: "status: draft", path: "読書メモ.md" }])
    });

    window.relic = makeRelicApi({
      getFrontmatterValueCandidates: vi.fn().mockResolvedValue({
        ok: true,
        value: { date: ["2026-05-12"], status: ["draft"] }
      }),
      getUserDefinedFields: vi.fn().mockResolvedValue({
        ok: true,
        value: [{ choices: ["draft", "published"], name: "reviewer", type: "text" }]
      }),
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      searchWorkspace
    });

    await renderApp();

    await screen.findByLabelText("ファイル検索");
    fireEvent.click(screen.getByRole("button", { name: "検索方法" }));
    fireEvent.click(await screen.findByRole("option", { name: "プロパティ" }));
    expect(screen.getByRole("option", { name: "reviewer" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "date" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("プロパティ名"), {
      target: { value: "status" }
    });
    fireEvent.change(screen.getByLabelText("ファイル検索"), {
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

  it("右パネルのリンクを右クリックしてコピーと場所表示を実行する", async () => {
    const revealWorkspaceItem = vi.fn().mockResolvedValue({ ok: true, value: undefined });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...withWorkspace,
          fileTree: [
            { name: "読書メモ", path: "読書メモ.md", type: "file" },
            { name: "参照先", path: "参照先.md", type: "file" }
          ]
        }
      }),
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "[[参照先|表示名]]", name: "読書メモ", path: "読書メモ.md" }
      }),
      revealWorkspaceItem
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    fireEvent.click(screen.getByRole("button", { name: "リンク" }));

    fireEvent.contextMenu(await screen.findByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Markdownリンクをコピー" }));
    expect(writeText).toHaveBeenCalledWith("[[参照先|表示名]]");

    fireEvent.contextMenu(screen.getByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "パスをコピー" }));
    expect(writeText).toHaveBeenCalledWith("参照先.md");

    fireEvent.contextMenu(screen.getByRole("button", { name: "表示名" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "ファイルの場所を表示" }));
    await waitFor(() => {
      expect(revealWorkspaceItem).toHaveBeenCalledWith({ path: "参照先.md" });
    });
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
