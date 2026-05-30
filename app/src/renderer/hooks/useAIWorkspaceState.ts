import { useCallback, useEffect, useState } from "react";

import type { AIWorkspaceState } from "../../shared/ipc";

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
  isAIWorkspaceLoading: boolean;
  isAIWorkspaceSending: boolean;
  reloadAIWorkspace: () => Promise<void>;
  rebuildAIWorkspaceIndex: () => Promise<void>;
  sendAIWorkspaceMessage: (message: string) => Promise<void>;
  clearAIWorkspaceData: () => Promise<void>;
} {
  const [aiWorkspaceState, setAIWorkspaceState] = useState<AIWorkspaceState | null>(null);
  const [isAIWorkspaceLoading, setIsAIWorkspaceLoading] = useState(false);
  const [isAIWorkspaceSending, setIsAIWorkspaceSending] = useState(false);

  const reloadAIWorkspace = useCallback(async (): Promise<void> => {
    if (!isEnabled || !workspaceId) {
      setAIWorkspaceState(null);
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
  }, [isEnabled, onError, workspaceId]);

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

  const sendAIWorkspaceMessage = useCallback(async (message: string): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.sendAIWorkspaceMessage) return;

    setIsAIWorkspaceSending(true);
    const result = await window.relic.sendAIWorkspaceMessage({ message });
    setIsAIWorkspaceSending(false);

    if (!result.ok) {
      onError(result.error.message);
      return;
    }

    setAIWorkspaceState(result.value);
  }, [isEnabled, onError, workspaceId]);

  const clearAIWorkspaceData = useCallback(async (): Promise<void> => {
    if (!isEnabled || !workspaceId) return;
    if (!window.relic?.clearAIWorkspaceData) return;

    setIsAIWorkspaceLoading(true);
    const result = await window.relic.clearAIWorkspaceData({ includeHistory: true, includeIndex: true });
    setIsAIWorkspaceLoading(false);

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
    isAIWorkspaceLoading,
    isAIWorkspaceSending,
    reloadAIWorkspace,
    rebuildAIWorkspaceIndex,
    sendAIWorkspaceMessage,
    clearAIWorkspaceData
  };
}
