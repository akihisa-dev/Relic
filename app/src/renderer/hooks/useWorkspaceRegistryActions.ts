import { relicClient } from "../relicClient";
import { useCallback, useState } from "react";

import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import { useAsyncRequestGuard } from "./useAsyncRequestGuard";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

type WorkspaceRegistryInput = Pick<
  WorkspaceFileActionsContext,
  "closeAllTabs" | "setWorkspaceError" | "setWorkspaceState"
> & {
  activeWorkspaceId?: string | null;
  activeWorkspacePath?: string | null;
  beforeCloseAllTabs?: () => Promise<boolean> | boolean;
} & WorkspaceRequestGuard;

export function useWorkspaceRegistryActions({
  activeWorkspaceId,
  activeWorkspacePath,
  beginWorkspaceRequest,
  beforeCloseAllTabs,
  closeAllTabs,
  invalidateWorkspaceRequests,
  setWorkspaceError,
  setWorkspaceState
}: WorkspaceRegistryInput) {
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [isRelinkingWorkspace, setIsRelinkingWorkspace] = useState(false);
  const beginLatestActivationRequest = useAsyncRequestGuard([]);
  const beginWorkspaceActivationRequest = useCallback(() => {
    const isLatestActivation = beginLatestActivationRequest();
    const isOriginWorkspace = activeWorkspaceId === null
      ? () => true
      : beginWorkspaceRequest();
    return () => isLatestActivation() && isOriginWorkspace();
  }, [activeWorkspaceId, beginLatestActivationRequest, beginWorkspaceRequest]);
  const applyActivatedWorkspaceState = useCallback((state: Parameters<typeof setWorkspaceState>[0]): void => {
    invalidateWorkspaceRequests(state.activeWorkspace?.id ?? null);
    setWorkspaceState(state);
    closeAllTabs();
  }, [closeAllTabs, invalidateWorkspaceRequests, setWorkspaceState]);
  const applySelectedWorkspaceState = useCallback((state: Parameters<typeof setWorkspaceState>[0]): void => {
    const selectedWorkspace = state.activeWorkspace;
    const activeWorkspaceUnchanged = (selectedWorkspace?.id ?? null) === activeWorkspaceId
      && (selectedWorkspace?.path ?? null) === activeWorkspacePath;

    if (activeWorkspaceUnchanged) {
      setWorkspaceState(state);
      return;
    }

    applyActivatedWorkspaceState(state);
  }, [activeWorkspaceId, activeWorkspacePath, applyActivatedWorkspaceState, setWorkspaceState]);

  const handleOpenWorkspace = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      setIsOpeningWorkspace(true);
      setWorkspaceError(null);

      void relic
        .openWorkspace()
        .then((result) => {
          if (!isCurrentRequest()) return;
          if (result.ok) {
            applySelectedWorkspaceState(result.value);
          } else {
            setWorkspaceError(result.error.message);
          }
        })
        .finally(() => setIsOpeningWorkspace(false));
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError]);

  const handleCreateNewWorkspace = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      setIsCreatingWorkspace(true);
      setWorkspaceError(null);

      void relic
        .createNewWorkspace()
        .then((result) => {
          if (!isCurrentRequest()) return;
          if (result.ok) {
            applySelectedWorkspaceState(result.value);
          } else {
            setWorkspaceError(result.error.message);
          }
        })
        .finally(() => setIsCreatingWorkspace(false));
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError]);

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      void relic.switchWorkspace({ workspaceId }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          applySelectedWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError]);

  const handleRemoveWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = workspaceId === activeWorkspaceId
      ? beginWorkspaceActivationRequest()
      : beginWorkspaceRequest();
    if (!isCurrentRequest()) return;

    const removeWorkspace = (): void => {
      if (!isCurrentRequest()) return;
      void relic.removeWorkspace({ workspaceId }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          if (workspaceId === activeWorkspaceId) {
            applySelectedWorkspaceState(result.value);
          } else {
            setWorkspaceState(result.value);
          }
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    };

    if (workspaceId === activeWorkspaceId) runAfterCloseCheck(beforeCloseAllTabs, removeWorkspace);
    else removeWorkspace();
  }, [activeWorkspaceId, applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, beginWorkspaceRequest, setWorkspaceError, setWorkspaceState]);

  const handleRelinkWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentRequest = beginWorkspaceActivationRequest();
    if (!isCurrentRequest()) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      if (!isCurrentRequest()) return;
      setIsRelinkingWorkspace(true);
      setWorkspaceError(null);
      void relic.relinkWorkspace({ workspaceId }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          applySelectedWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      }).finally(() => setIsRelinkingWorkspace(false));
    });
  }, [applySelectedWorkspaceState, beforeCloseAllTabs, beginWorkspaceActivationRequest, setWorkspaceError]);

  const handleRenameWorkspace = useCallback(async (workspaceId: string, name: string): Promise<boolean> => {
    if (!relicClient.current) return false;
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return false;

    const result = await relicClient.current.renameWorkspace({ name, workspaceId });
    if (!isCurrentRequest()) return false;
    if (result.ok) {
      if (result.value.activeWorkspace?.id !== activeWorkspaceId) {
        invalidateWorkspaceRequests(result.value.activeWorkspace?.id ?? null);
      }
      setWorkspaceState(result.value);
      return true;
    }

    setWorkspaceError(result.error.message);
    return false;
  }, [activeWorkspaceId, beginWorkspaceRequest, invalidateWorkspaceRequests, setWorkspaceError, setWorkspaceState]);

  const handleRevealWorkspace = useCallback((workspaceId: string): void => {
    if (!relicClient.current) return;
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return;

    void relicClient.current.revealWorkspaceItem({ path: "", workspaceId }).then((result) => {
      if (!isCurrentRequest()) return;
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [beginWorkspaceRequest, setWorkspaceError]);

  const handleRefreshWorkspaceState = useCallback((): void => {
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return;
    void relicClient.current?.getWorkspaceState().then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) {
        if (result.value.activeWorkspace?.id !== activeWorkspaceId) {
          invalidateWorkspaceRequests(result.value.activeWorkspace?.id ?? null);
        }
        setWorkspaceState(result.value);
      }
    });
  }, [activeWorkspaceId, beginWorkspaceRequest, invalidateWorkspaceRequests, setWorkspaceState]);

  const handleTogglePin = useCallback((path: string): void => {
    if (!relicClient.current) return;
    const isCurrentRequest = beginWorkspaceRequest();
    if (!isCurrentRequest()) return;

    void relicClient.current.togglePin(path).then((result) => {
      if (!isCurrentRequest()) return;
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    });
  }, [beginWorkspaceRequest, setWorkspaceError, setWorkspaceState]);

  return {
    handleCreateNewWorkspace,
    handleOpenWorkspace,
    handleRefreshWorkspaceState,
    handleRelinkWorkspace,
    handleRevealWorkspace,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleTogglePin,
    isCreatingWorkspace,
    isOpeningWorkspace,
    isRelinkingWorkspace
  };
}

function runAfterCloseCheck(
  beforeCloseAllTabs: (() => Promise<boolean> | boolean) | undefined,
  action: () => void
): void {
  const canClose = beforeCloseAllTabs?.() ?? true;

  if (typeof canClose === "boolean") {
    if (canClose) action();
    return;
  }

  void canClose.then((result) => {
    if (result) action();
  });
}
