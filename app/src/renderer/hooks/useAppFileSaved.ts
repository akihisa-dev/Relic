import { useCallback } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { relicClient } from "../relicClient";

interface UseAppFileSavedOptions {
  hasOpenChart: boolean;
  reloadCharts: () => Promise<boolean>;
  setWorkspaceError: (message: string) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
}

export function useAppFileSaved({
  hasOpenChart,
  reloadCharts,
  setWorkspaceError,
  setWorkspaceState
}: UseAppFileSavedOptions): (path?: string) => void {
  return useCallback((path?: string): void => {
    if (hasOpenChart) void reloadCharts();
    if (!path || !relicClient.current) return;

    void relicClient.current.getWorkspaceState().then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        return;
      }
      setWorkspaceError(result.error.message);
    }).catch((error) => {
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [hasOpenChart, reloadCharts, setWorkspaceError, setWorkspaceState]);
}
