import {
  act,
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

describe("App Cowork", () => {
  beforeAll(installMatchMediaMock);

  beforeEach(() => {
    setNavigatorPlatform("MacIntel");
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreNavigatorPlatform();
    resetRendererStores();
  });

  it("Coworkへ現在ファイルの未保存本文とdirty状態を直接渡す", async () => {
    const previewAIWorkspaceMessage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        message: "このファイルを整理して",
        references: [{ line: 1, path: "読書メモ.md", preview: "# 未保存" }],
        requiresExternalAI: true,
        skippedLargeFiles: [],
        unreadableFiles: []
      }
    });
    const sendAIWorkspaceMessage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        aiProvider: "codex-app-server",
        openAIAPIKeyConfigured: true,
        history: [],
        index: { chunkCount: 1, indexedAt: "2026-05-30T00:00:00.000Z", indexedFileCount: 1, skippedLargeFiles: [], unreadableFiles: [] },
        operationHistory: [],
        pendingOperations: []
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
      getAIWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          aiProvider: "codex-app-server",
          openAIAPIKeyConfigured: true,
          history: [],
          index: { chunkCount: 1, indexedAt: "2026-05-30T00:00:00.000Z", indexedFileCount: 1, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      }),
      previewAIWorkspaceMessage,
      readMarkdownFile: vi.fn().mockResolvedValue({
        ok: true,
        value: { content: "# 保存済み\nold", name: "読書メモ", path: "読書メモ.md" }
      }),
      sendAIWorkspaceMessage
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /読書メモ/ }));
    await waitFor(() => {
      expect(useEditorStore.getState().leftPane.activeTabId).not.toBeNull();
    });

    const activeTabId = useEditorStore.getState().leftPane.activeTabId!;
    act(() => {
      useEditorStore.getState().updateTabContent(activeTabId, "# 未保存\nnew draft");
    });

    fireEvent.click(screen.getByRole("button", { name: "Cowork" }));
    const input = await screen.findByLabelText("AIへのメッセージ");
    fireEvent.change(input, { target: { value: "このファイルを整理して" } });
    fireEvent.click(screen.getByRole("button", { name: "送信" }));

    await waitFor(() => {
      expect(sendAIWorkspaceMessage).toHaveBeenCalledWith({
        activeFileContent: "# 未保存\nnew draft",
        activeFilePath: "読書メモ.md",
        dirtyFilePaths: ["読書メモ.md"],
        message: "このファイルを整理して"
      });
    });
    expect(previewAIWorkspaceMessage).not.toHaveBeenCalled();
    expect(screen.queryByText("AIへ送るMarkdown参照")).not.toBeInTheDocument();
    expect(useUiStore.getState().isSecondarySidebarOpen).toBe(true);
    expect(useUiStore.getState().secondarySidebarView).toBe("ai-chat");
  });

  it("左レールのCoworkでチャット履歴を表示して切り替えられる", async () => {
    const aiState = {
      activeChatId: "chat-1",
      aiProvider: "codex-app-server" as const,
      chats: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          id: "chat-1",
          messageCount: 2,
          title: "以前のチャット",
          updatedAt: "2026-05-30T00:00:00.000Z"
        },
        {
          createdAt: "2026-05-31T00:00:00.000Z",
          id: "chat-2",
          messageCount: 0,
          title: "認証整理",
          updatedAt: "2026-05-31T00:00:00.000Z"
        }
      ],
      history: [],
      index: { chunkCount: 1, indexedAt: "2026-05-30T00:00:00.000Z", indexedFileCount: 1, skippedLargeFiles: [], unreadableFiles: [] },
      openAIAPIKeyConfigured: true,
      operationHistory: [],
      pendingOperations: [],
      codexUsage: {
        planType: "prolite",
        primary: {
          remainingPercent: 76,
          resetsAt: "2026-05-31T05:05:35.000Z",
          usedPercent: 24,
          windowDurationMins: 300
        },
        readAt: "2026-05-31T04:30:00.000Z",
        secondary: {
          remainingPercent: 97,
          resetsAt: "2026-06-07T01:37:56.000Z",
          usedPercent: 3,
          windowDurationMins: 10080
        }
      }
    };
    const createAIWorkspaceChat = vi.fn().mockResolvedValue({ ok: true, value: aiState });
    const selectAIWorkspaceChat = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...aiState, activeChatId: "chat-2" }
    });

    window.relic = makeRelicApi({
      createAIWorkspaceChat,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getAIWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: aiState }),
      selectAIWorkspaceChat
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Cowork" }));

    expect(await screen.findByRole("button", { name: "新規チャット" })).toBeInTheDocument();
    expect(useUiStore.getState().isSecondarySidebarOpen).toBe(true);
    expect(useUiStore.getState().secondarySidebarView).toBe("ai-chat");
    expect(screen.getByLabelText("AIへのメッセージ")).toBeInTheDocument();
    expect(screen.getByLabelText("Codex残り使用量")).toBeInTheDocument();
    expect(screen.getByText("5時間")).toBeInTheDocument();
    expect(screen.getByText("76%")).toBeInTheDocument();
    expect(screen.getByText("1週間")).toBeInTheDocument();
    expect(screen.getByText("97%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /以前のチャット 2件/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /認証整理 未開始/ }));

    await waitFor(() => {
      expect(selectAIWorkspaceChat).toHaveBeenCalledWith({ chatId: "chat-2" });
    });
    expect(useUiStore.getState().isSecondarySidebarOpen).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "新規チャット" }));
    expect(createAIWorkspaceChat).toHaveBeenCalledWith({});
    fireEvent.click(screen.getByRole("button", { name: "Coworkサイドバーを閉じる" }));
    expect(useUiStore.getState().isSidebarOpen).toBe(false);
    expect(useUiStore.getState().isSecondarySidebarOpen).toBe(true);
    expect(screen.getByLabelText("AIへのメッセージ")).toBeInTheDocument();
  });

  it("左サイドバーのAIチャット履歴から確認後にチャットを削除できる", async () => {
    const aiState = {
      activeChatId: "chat-1",
      aiProvider: "codex-app-server" as const,
      chats: [
        {
          createdAt: "2026-05-30T00:00:00.000Z",
          id: "chat-1",
          messageCount: 2,
          title: "削除するチャット",
          updatedAt: "2026-05-30T00:00:00.000Z"
        }
      ],
      history: [],
      index: { chunkCount: 1, indexedAt: "2026-05-30T00:00:00.000Z", indexedFileCount: 1, skippedLargeFiles: [], unreadableFiles: [] },
      openAIAPIKeyConfigured: true,
      operationHistory: [],
      pendingOperations: []
    };
    const deleteAIWorkspaceChat = vi.fn().mockResolvedValue({
      ok: true,
      value: { ...aiState, activeChatId: null, chats: [] }
    });

    window.relic = makeRelicApi({
      deleteAIWorkspaceChat,
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getAIWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: aiState })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Cowork" }));
    fireEvent.click(await screen.findByRole("button", { name: "削除するチャットを削除" }));

    expect(screen.getByText("このチャットを削除しますか？Markdownファイルには影響しません。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));

    await waitFor(() => {
      expect(deleteAIWorkspaceChat).toHaveBeenCalledWith({ chatId: "chat-1" });
    });
  });

  it("OpenAI API方式では管理画面で使用量を確認する表示を出す", async () => {
    const aiState = {
      activeChatId: "chat-1",
      aiProvider: "openai-api" as const,
      chats: [
        {
          createdAt: "2026-05-31T00:00:00.000Z",
          id: "chat-1",
          messageCount: 0,
          title: "API確認",
          updatedAt: "2026-05-31T00:00:00.000Z"
        }
      ],
      history: [],
      index: { chunkCount: 1, indexedAt: "2026-05-30T00:00:00.000Z", indexedFileCount: 1, skippedLargeFiles: [], unreadableFiles: [] },
      openAIAPIKeyConfigured: true,
      operationHistory: [],
      pendingOperations: []
    };

    window.relic = makeRelicApi({
      getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: withWorkspace }),
      getAIWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: aiState })
    });

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "Cowork" }));

    expect(await screen.findByLabelText("OpenAI API使用量")).toBeInTheDocument();
    expect(screen.getByText("OpenAI API使用量")).toBeInTheDocument();
    expect(screen.getByText("OpenAI管理画面で確認")).toBeInTheDocument();
    expect(screen.queryByLabelText("Codex残り使用量")).not.toBeInTheDocument();
  });
});
