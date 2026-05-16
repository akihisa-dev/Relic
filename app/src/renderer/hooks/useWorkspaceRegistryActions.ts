import { useCallback, useState } from "react";

import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";

type WorkspaceRegistryInput = Pick<
  WorkspaceFileActionsContext,
  "closeAllTabs" | "setWorkspaceError" | "setWorkspaceState"
>;

export function useWorkspaceRegistryActions({
  closeAllTabs,
  setWorkspaceError,
  setWorkspaceState
}: WorkspaceRegistryInput) {
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

  const handleOpenWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsOpeningWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .openWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsOpeningWorkspace(false));
  }, [setWorkspaceError, setWorkspaceState]);

  const handleCreateNewWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .createNewWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingWorkspace(false));
  }, [setWorkspaceError, setWorkspaceState]);

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    if (!window.relic) return;

    void window.relic.switchWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        closeAllTabs();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleRemoveWorkspace = useCallback((workspaceId: string): void => {
    if (!window.relic) return;

    void window.relic.removeWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        closeAllTabs();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeAllTabs, setWorkspaceError, setWorkspaceState]);

  const handleRenameWorkspace = useCallback(async (workspaceId: string, name: string): Promise<boolean> => {
    if (!window.relic) return false;

    const result = await window.relic.renameWorkspace({ name, workspaceId });
    if (result.ok) {
      setWorkspaceState(result.value);
      return true;
    }

    setWorkspaceError(result.error.message);
    return false;
  }, [setWorkspaceError, setWorkspaceState]);

  const handleRefreshWorkspaceState = useCallback((): void => {
    void window.relic?.getWorkspaceState().then((result) => {
      if (result.ok) setWorkspaceState(result.value);
    });
  }, [setWorkspaceState]);

  const handleTogglePin = useCallback((path: string): void => {
    if (!window.relic) return;

    void window.relic.togglePin(path).then((result) => {
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError, setWorkspaceState]);

  return {
    handleCreateNewWorkspace,
    handleOpenWorkspace,
    handleRefreshWorkspaceState,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleTogglePin,
    isCreatingWorkspace,
    isOpeningWorkspace
  };
}
