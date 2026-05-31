import { useCallback, useEffect, useState } from "react";

import type { AIWorkspaceMessagePreview, AIWorkspaceState } from "../../shared/ipc";

interface UseAIWorkspaceStateOptions {
  isEnabled: boolean;
  onError: (message: string) => void;
  workspaceId?: string | null;
}

export function useAIWorkspaceState({
  isEnabled,
  onError,
  workspaceId
}: UseAIWorkspaceStateOptions): {
  aiWorkspaceState: AIWorkspaceState | null;
  aiWorkspaceMessagePreview: AIWorkspaceMessagePreview | null;
  isAIWorkspaceLoading: boolean;
  isAIWorkspaceSending: boolean;
  reloadAIWorkspace: () => Promise<void>;
  createAIWorkspaceChat: () => Promise<void>;
  selectAIWorkspaceChat: (chatId: string) => Promise<void>;
  deleteAIWorkspaceChat: (chatId: string) => Promise<void>;
  rebuildAIWorkspaceIndex: () => Promise<void>;
  sendAIWorkspaceMessage: (
    message: string,
    dirtyFilePaths?: string[],
    activeFilePath?: string | null,
    activeFileContent?: string | null
  ) => Promise<void>;
  cancelAIWorkspaceMessage: () => Promise<void>;
  confirmAIWorkspaceMessage: (
    dirtyFilePaths?: string[],
    activeFilePath?: string | null,
    activeFileContent?: string | null
  ) => Promise<void>;
  applyAIWorkspaceOperations: (dirtyFilePaths?: string[], operationIds?: string[]) => Promise<void>;
  discardAIWorkspaceOperations: (operationIds?: string[]) => Promise<void>;
  clearAIWorkspaceData: () => Promise<void>;
} {
  const [aiWorkspaceState, setAIWorkspaceState] = useState<AIWorkspaceState | null>(null);
  const [isAIWorkspaceLoading, setIsAIWorkspaceLoading] = useState(false);
  const [isAIWorkspaceSending, setIsAIWorkspaceSending] = useState(false);

  const resetMessagePreview = useCallback((): void => {
  }, []);

  const reloadAIWorkspace = useCallback(async (): Promise<void> => {
    if (!isEnabled || !workspaceId) {
      setAIWorkspaceState(null);
      resetMessagePreview();
      return;
    }

    if (!window.relic?.getAIWorkspaceState) return;

    setIsAIWorkspaceLoading(true);
    const result = await window.relic.getAIWorkspaceState();
    setIsAIWorkspaceLoading(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, resetMessagePreview, workspaceId]);

  const createAIWorkspaceChat = useCallback(async (): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.createAIWorkspaceChat) return;

    resetMessagePreview();
    setIsAIWorkspaceLoading(true);
    const result = await window.relic.createAIWorkspaceChat({});
    setIsAIWorkspaceLoading(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, resetMessagePreview, workspaceId]);

  const selectAIWorkspaceChat = useCallback(async (chatId: string): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.selectAIWorkspaceChat) return;
    if (chatId === aiWorkspaceState?.activeChatId) return;

    resetMessagePreview();
    setIsAIWorkspaceLoading(true);
    const result = await window.relic.selectAIWorkspaceChat({ chatId });
    setIsAIWorkspaceLoading(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [aiWorkspaceState?.activeChatId, isEnabled, onError, resetMessagePreview, workspaceId]);

  const deleteAIWorkspaceChat = useCallback(async (chatId: string): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.deleteAIWorkspaceChat) return;

    resetMessagePreview();
    setIsAIWorkspaceLoading(true);
    const result = await window.relic.deleteAIWorkspaceChat({ chatId });
    setIsAIWorkspaceLoading(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, resetMessagePreview, workspaceId]);

  const rebuildAIWorkspaceIndex = useCallback(async (): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.rebuildAIWorkspaceIndex) return;

    setIsAIWorkspaceLoading(true);
    const result = await window.relic.rebuildAIWorkspaceIndex({ force: true });
    setIsAIWorkspaceLoading(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, workspaceId]);

  const sendAIWorkspaceMessage = useCallback(async (
    message: string,
    dirtyFilePaths: string[] = [],
    activeFilePath: string | null = null,
    activeFileContent: string | null = null
  ): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.sendAIWorkspaceMessage) return;

    setIsAIWorkspaceSending(true);
    const result = await window.relic.sendAIWorkspaceMessage({ activeFileContent, activeFilePath, dirtyFilePaths, message });
    setIsAIWorkspaceSending(false);

    if (!result.ok) {
      if (result.error.code === "AI_WORKSPACE_MESSAGE_CANCELLED") return;
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, workspaceId]);

  const confirmAIWorkspaceMessage = useCallback(async (
    _dirtyFilePaths: string[] = [],
    _activeFilePath: string | null = null,
    _activeFileContent: string | null = null
  ): Promise<void> => {
    resetMessagePreview();
  }, [resetMessagePreview]);

  const cancelAIWorkspaceMessage = useCallback(async (): Promise<void> => {
    resetMessagePreview();
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.cancelAIWorkspaceMessage) return;

    const result = await window.relic.cancelAIWorkspaceMessage();
    setIsAIWorkspaceSending(false);

    if (!result.ok) {
      onError(result.error.message);
    }
  }, [isEnabled, onError, resetMessagePreview, workspaceId]);

  const clearAIWorkspaceData = useCallback(async (): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.clearAIWorkspaceData) return;

    resetMessagePreview();
    setIsAIWorkspaceLoading(true);
    const result = await window.relic.clearAIWorkspaceData({ includeHistory: true, includeIndex: true });
    setIsAIWorkspaceLoading(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    resetMessagePreview();
    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, resetMessagePreview, workspaceId]);

  const applyAIWorkspaceOperations = useCallback(async (
    dirtyFilePaths: string[] = [],
    operationIds?: string[]
  ): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.applyAIWorkspaceOperations) return;

    setIsAIWorkspaceSending(true);
    const result = await window.relic.applyAIWorkspaceOperations({ dirtyFilePaths, operationIds });
    setIsAIWorkspaceSending(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, workspaceId]);

  const discardAIWorkspaceOperations = useCallback(async (operationIds?: string[]): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.discardAIWorkspaceOperations) return;

    setIsAIWorkspaceSending(true);
    const result = await window.relic.discardAIWorkspaceOperations({ operationIds });
    setIsAIWorkspaceSending(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, workspaceId]);

  useEffect(() => {
    void reloadAIWorkspace();
  }, [reloadAIWorkspace]);

  return {
    aiWorkspaceState,
    aiWorkspaceMessagePreview: null,
    isAIWorkspaceLoading,
    isAIWorkspaceSending,
    reloadAIWorkspace,
    createAIWorkspaceChat,
    selectAIWorkspaceChat,
    deleteAIWorkspaceChat,
    rebuildAIWorkspaceIndex,
    sendAIWorkspaceMessage,
    confirmAIWorkspaceMessage,
    cancelAIWorkspaceMessage,
    applyAIWorkspaceOperations,
    discardAIWorkspaceOperations,
    clearAIWorkspaceData
  };
}
