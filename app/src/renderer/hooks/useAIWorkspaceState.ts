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
  rebuildAIWorkspaceIndex: () => Promise<void>;
  sendAIWorkspaceMessage: (
    message: string,
    dirtyFilePaths?: string[],
    activeFilePath?: string | null,
    activeFileContent?: string | null
  ) => Promise<void>;
  confirmAIWorkspaceMessage: (
    dirtyFilePaths?: string[],
    activeFilePath?: string | null,
    activeFileContent?: string | null
  ) => Promise<void>;
  cancelAIWorkspaceMessage: () => void;
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

  const cancelAIWorkspaceMessage = useCallback((): void => {
    resetMessagePreview();
  }, [resetMessagePreview]);

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
    rebuildAIWorkspaceIndex,
    sendAIWorkspaceMessage,
    confirmAIWorkspaceMessage,
    cancelAIWorkspaceMessage,
    applyAIWorkspaceOperations,
    discardAIWorkspaceOperations,
    clearAIWorkspaceData
  };
}
