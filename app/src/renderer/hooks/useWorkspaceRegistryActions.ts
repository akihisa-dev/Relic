import { relicClient } from "../relicClient";
import { useCallback, useState } from "react";

import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";

type WorkspaceRegistryInput = Pick<
  WorkspaceFileActionsContext,
  "closeAllTabs" | "setWorkspaceError" | "setWorkspaceState"
> & {
  beforeCloseAllTabs?: () => Promise<boolean> | boolean;
};

export function useWorkspaceRegistryActions({
  beforeCloseAllTabs,
  closeAllTabs,
  setWorkspaceError,
  setWorkspaceState
}: WorkspaceRegistryInput) {
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const handleOpenWorkspace = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      setIsOpeningWorkspace(true);
      setWorkspaceError(null);

      void relic
        .openWorkspace()
        .then((result) => {
          if (result.ok) {
            setWorkspaceState(result.value);
            closeAllTabs();
          } else {
            setWorkspaceError(result.error.message);
          }
        })
        .finally(() => setIsOpeningWorkspace(false));
    });
  }, [beforeCloseAllTabs, closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleCreateNewWorkspace = useCallback((): void => {
    const relic = relicClient.current;
    if (!relic) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      setIsCreatingWorkspace(true);
      setWorkspaceError(null);

      void relic
        .createNewWorkspace()
        .then((result) => {
          if (result.ok) {
            setWorkspaceState(result.value);
            closeAllTabs();
          } else {
            setWorkspaceError(result.error.message);
          }
        })
        .finally(() => setIsCreatingWorkspace(false));
    });
  }, [beforeCloseAllTabs, closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      void relic.switchWorkspace({ workspaceId }).then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          closeAllTabs();
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    });
  }, [beforeCloseAllTabs, closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleRemoveWorkspace = useCallback((workspaceId: string): void => {
    const relic = relicClient.current;
    if (!relic) return;

    runAfterCloseCheck(beforeCloseAllTabs, () => {
      void relic.removeWorkspace({ workspaceId }).then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          closeAllTabs();
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    });
  }, [beforeCloseAllTabs, closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleRenameWorkspace = useCallback(async (workspaceId: string, name: string): Promise<boolean> => {
    if (!relicClient.current) return false;

    const result = await relicClient.current.renameWorkspace({ name, workspaceId });
    if (result.ok) {
      setWorkspaceState(result.value);
      return true;
    }

    setWorkspaceError(result.error.message);
    return false;
  }, [setWorkspaceError, setWorkspaceState]);

  const handleRevealWorkspace = useCallback((workspaceId: string): void => {
    if (!relicClient.current) return;

    void relicClient.current.revealWorkspaceItem({ path: "", workspaceId }).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  const handleRefreshWorkspaceState = useCallback((): void => {
    void relicClient.current?.getWorkspaceState().then((result) => {
      if (result.ok) setWorkspaceState(result.value);
    });
  }, [setWorkspaceState]);

  const handleTogglePin = useCallback((path: string): void => {
    if (!relicClient.current) return;

    void relicClient.current.togglePin(path).then((result) => {
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError, setWorkspaceState]);

  return {
    handleCreateNewWorkspace,
    handleOpenWorkspace,
    handleRefreshWorkspaceState,
    handleRevealWorkspace,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleTogglePin,
    isCreatingWorkspace,
    isOpeningWorkspace
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
