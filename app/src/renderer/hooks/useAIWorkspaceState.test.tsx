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
          codexAppServerAvailable: true,
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
      })
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("clears a pending send preview when AI Workspace data is cleared", async () => {
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

    expect(hook.result.current.aiWorkspaceMessagePreview).toEqual(expect.objectContaining({
      message: "認証を整理して"
    }));

    await act(async () => {
      await hook.result.current.clearAIWorkspaceData();
    });

    expect(window.relic?.clearAIWorkspaceData).toHaveBeenCalledWith({ includeHistory: true, includeIndex: true });
    await waitFor(() => {
      expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("clears a pending send preview when AI Workspace becomes disabled", async () => {
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

    expect(hook.result.current.aiWorkspaceMessagePreview).not.toBeNull();

    hook.rerender({ isEnabled: false });

    await waitFor(() => {
      expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    });
  });

  it("does not confirm a pending send preview after the editor context changed", async () => {
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

    expect(window.relic?.sendAIWorkspaceMessage).not.toHaveBeenCalled();
    expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    expect(onError).toHaveBeenCalledWith("送信確認後にMarkdownの状態が変わりました。もう一度AIへ送信してください。");
  });

  it("does not show an external AI send preview when AI collaboration is unavailable", async () => {
    const onError = vi.fn();
    window.relic = makeRelicApi({
      getAIWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          codexAppServerAvailable: false,
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
      })
    });
    const hook = renderHook(() => useAIWorkspaceState({
      isEnabled: true,
      onError,
      workspaceId: "workspace-1"
    }));

    await waitFor(() => {
      expect(hook.result.current.aiWorkspaceState?.codexAppServerAvailable).toBe(false);
    });

    await act(async () => {
      await hook.result.current.sendAIWorkspaceMessage("認証を整理して");
    });

    expect(hook.result.current.aiWorkspaceMessagePreview).toBeNull();
    expect(window.relic?.sendAIWorkspaceMessage).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("AI共同作業を開始できません。Codexアプリを確認してください。");
  });

  it("keeps local AI workspace operations available when AI collaboration is unavailable", async () => {
    const onError = vi.fn();
    window.relic = makeRelicApi({
      getAIWorkspaceState: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          codexAppServerAvailable: false,
          history: [],
          index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
          operationHistory: [],
          pendingOperations: []
        }
      }),
      previewAIWorkspaceMessage: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          message: "それ反映して",
          references: [],
          requiresExternalAI: false,
          skippedLargeFiles: [],
          unreadableFiles: []
        }
      })
    });
    const hook = renderHook(() => useAIWorkspaceState({
      isEnabled: true,
      onError,
      workspaceId: "workspace-1"
    }));

    await waitFor(() => {
      expect(window.relic?.getAIWorkspaceState).toHaveBeenCalled();
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
