import { useCallback } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { relicClient } from "../relicClient";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

interface UseAppFileSavedOptions extends Pick<WorkspaceRequestGuard, "beginWorkspaceRequest"> {
  hasOpenChart: boolean;
  reloadCharts: () => Promise<boolean>;
  setWorkspaceError: (message: string) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
}

export function useAppFileSaved({
  beginWorkspaceRequest,
  hasOpenChart,
  reloadCharts,
  setWorkspaceError,
  setWorkspaceState
}: UseAppFileSavedOptions): (path?: string) => void {
  return useCallback((path?: string): void => {
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    if (hasOpenChart) void reloadCharts();
    if (!path || !relicClient.current) return;
    const relic = relicClient.current;

    void relic.getWorkspaceState().then((result) => {
      if (!isCurrentWorkspace()) return;
      if (result.ok) {
        setWorkspaceState(result.value);
        return;
      }
      setWorkspaceError(result.error.message);
    }).catch((error) => {
      if (!isCurrentWorkspace()) return;
      setWorkspaceError(error instanceof Error ? error.message : String(error));
    });
  }, [beginWorkspaceRequest, hasOpenChart, reloadCharts, setWorkspaceError, setWorkspaceState]);
}
