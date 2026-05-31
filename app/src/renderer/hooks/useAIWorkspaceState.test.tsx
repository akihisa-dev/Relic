import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeRelicApi } from "../../test/rendererTestUtils";
import { useAIWorkspaceState } from "./useAIWorkspaceState";

describe("useAIWorkspaceState", () => {
  beforeEach(() => {
    window.relic = makeRelicApi({
      getAIWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          aiProvider: "codex-app-server",
          openAIAPIKeyConfigured: true,
          history: [],
          index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      }),
      previewAIWorkspaceMessage: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          message: "認証を整理して",
          references: [{ line: 1, path: "docs/auth.md", preview: "# Auth" }],
          requiresExternalAI: true,
          skippedLargeFiles: [],
          unreadableFiles: []
        }
      }),
      sendAIWorkspaceMessage: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          aiProvider: "codex-app-server",
          openAIAPIKeyConfigured: true,
          history: [],
          index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      })
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends an AI Workspace message directly without a send preview", async () => {
    const onError = vi.fn();
    const hook = renderHook(() => useAIWorkspaceState({
      isEnabled: true,
      onError,
      workspaceId: "workspace-1"
    }));

    await waitFor(() => {
      expect(window.relic?.getAIWorkspaceState).toHaveBeenCalled();
    });

    await act(async () => {
      await hook.result.current.sendAIWorkspaceMessage("認証を整理して", [], "docs/auth.md", "# Auth");
    });

    expect(window.relic?.previewAIWorkspaceMessage).not.toHaveBeenCalled();
    expect(window.relic?.sendAIWorkspaceMessage).toHaveBeenCalledWith({
      activeFileContent: "# Auth",
      activeFilePath: "docs/auth.md",
      dirtyFilePaths: [],
      message: "認証を整理して"
    });
    expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps the message preview empty when AI Workspace becomes disabled", async () => {
    const onError = vi.fn();
    const hook = renderHook(
      ({ isEnabled }) => useAIWorkspaceState({
        isEnabled,
        onError,
        workspaceId: isEnabled ? "workspace-1" : null
      }),
      { initialProps: { isEnabled: true } }
    );

    await waitFor(() => {
      expect(window.relic?.getAIWorkspaceState).toHaveBeenCalled();
    });

    await act(async () => {
      await hook.result.current.sendAIWorkspaceMessage("認証を整理して");
    });

    expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();

    hook.rerender({ isEnabled: false });

    await waitFor(() => {
      expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    });
  });

  it("does not keep a pending preview when confirm is called for compatibility", async () => {
    const onError = vi.fn();
    const hook = renderHook(() => useAIWorkspaceState({
      isEnabled: true,
      onError,
      workspaceId: "workspace-1"
    }));

    await waitFor(() => {
      expect(window.relic?.getAIWorkspaceState).toHaveBeenCalled();
    });

    await act(async () => {
      await hook.result.current.sendAIWorkspaceMessage("認証を整理して", [], "docs/auth.md", "# Auth");
    });

    await act(async () => {
      await hook.result.current.confirmAIWorkspaceMessage(["docs/auth.md"], "docs/auth.md", "# Auth\nchanged");
    });

    expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("lets Main decide whether OpenAI API keys are required", async () => {
    const onError = vi.fn();
    window.relic = makeRelicApi({
      getAIWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          aiProvider: "openai-api",
          openAIAPIKeyConfigured: false,
          history: [],
          index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      }),
      sendAIWorkspaceMessage: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "AI_WORKSPACE_OPENAI_KEY_MISSING",
          message: "OpenAI APIキーをAI設定で登録してください。"
        }
      })
    });
    const hook = renderHook(() => useAIWorkspaceState({
      isEnabled: true,
      onError,
      workspaceId: "workspace-1"
    }));

    await waitFor(() => {
      expect(hook.result.current.aiWorkspaceState?.openAIAPIKeyConfigured).toBe(false);
    });

    await act(async () => {
      await hook.result.current.sendAIWorkspaceMessage("認証を整理して");
    });

    expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    expect(window.relic?.sendAIWorkspaceMessage).toHaveBeenCalledWith({
      activeFileContent: null,
      activeFilePath: null,
      dirtyFilePaths: [],
      message: "認証を整理して"
    });
    expect(onError).toHaveBeenCalledWith("OpenAI APIキーをAI設定で登録してください。");
  });

  it("does not block sends from stale OpenAI API state in the renderer", async () => {
    const onError = vi.fn();
    window.relic = makeRelicApi({
      getAIWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          aiProvider: "openai-api",
          openAIAPIKeyConfigured: false,
          history: [],
          index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      }),
      sendAIWorkspaceMessage: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          aiProvider: "codex-app-server",
          openAIAPIKeyConfigured: false,
          history: [],
          index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      })
    });
    const hook = renderHook(() => useAIWorkspaceState({
      isEnabled: true,
      onError,
      workspaceId: "workspace-1"
    }));

    await waitFor(() => {
      expect(hook.result.current.aiWorkspaceState?.openAIAPIKeyConfigured).toBe(false);
    });

    await act(async () => {
      await hook.result.current.sendAIWorkspaceMessage("それ反映して");
    });

    expect(window.relic?.sendAIWorkspaceMessage).toHaveBeenCalledWith({
      activeFileContent: null,
      activeFilePath: null,
      dirtyFilePaths: [],
      message: "それ反映して"
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
