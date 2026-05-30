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
  const [aiWorkspaceMessagePreview, setAIWorkspaceMessagePreview] = useState<AIWorkspaceMessagePreview | null>(null);
  const [previewDirtyFilePaths, setPreviewDirtyFilePaths] = useState<string[]>([]);
  const [previewActiveFilePath, setPreviewActiveFilePath] = useState<string | null>(null);
  const [previewActiveFileContent, setPreviewActiveFileContent] = useState<string | null>(null);
  const [isAIWorkspaceLoading, setIsAIWorkspaceLoading] = useState(false);
  const [isAIWorkspaceSending, setIsAIWorkspaceSending] = useState(false);

  const resetMessagePreview = useCallback((): void => {
    setAIWorkspaceMessagePreview(null);
    setPreviewActiveFileContent(null);
    setPreviewActiveFilePath(null);
    setPreviewDirtyFilePaths([]);
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
    if (!window.relic?.previewAIWorkspaceMessage) return;

    setIsAIWorkspaceSending(true);
    const previewResult = await window.relic.previewAIWorkspaceMessage({ activeFileContent, activeFilePath, message });
    setIsAIWorkspaceSending(false);

    if (!previewResult.ok) {
      onError(previewResult.error.message);
      return;
    }

    if (previewResult.value.requiresExternalAI) {
      setAIWorkspaceMessagePreview(previewResult.value);
      setPreviewDirtyFilePaths(dirtyFilePaths);
      setPreviewActiveFilePath(activeFilePath);
      setPreviewActiveFileContent(activeFileContent);
      return;
    }

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
    dirtyFilePaths: string[] = [],
    activeFilePath: string | null = null,
    activeFileContent: string | null = null
  ): Promise<void> => {
    if (!isEnabled || !workspaceId || !aiWorkspaceMessagePreview) return;
    if (!window.relic?.sendAIWorkspaceMessage) return;

    if (
      !sameStringList(previewDirtyFilePaths, dirtyFilePaths) ||
      previewActiveFilePath !== activeFilePath ||
      previewActiveFileContent !== activeFileContent
    ) {
      resetMessagePreview();
      onError("送信確認後にMarkdownの状態が変わりました。もう一度AIへ送信してください。");
      return;
    }

    setIsAIWorkspaceSending(true);
    const result = await window.relic.sendAIWorkspaceMessage({
      activeFilePath: previewActiveFilePath,
      activeFileContent: previewActiveFileContent,
      dirtyFilePaths: previewDirtyFilePaths,
      message: aiWorkspaceMessagePreview.message
    });
    setIsAIWorkspaceSending(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    resetMessagePreview();
    setAIWorkspaceState(result.value);
  }, [aiWorkspaceMessagePreview, isEnabled, onError, previewActiveFileContent, previewActiveFilePath, previewDirtyFilePaths, resetMessagePreview, workspaceId]);

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
    aiWorkspaceMessagePreview,
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

function sameStringList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  const leftItems = [...left].sort();
  const rightItems = [...right].sort();
  return leftItems.every((item, index) => item === rightItems[index]);
}
