import { useCallback } from "react";

import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

interface UseAppFileSavedOptions extends Pick<WorkspaceRequestGuard, "beginWorkspaceRequest"> {
  onWorkspaceDataChanged: () => Promise<boolean>;
}

export function useAppFileSaved({
  beginWorkspaceRequest,
  onWorkspaceDataChanged
}: UseAppFileSavedOptions): (path?: string) => void {
  return useCallback((path?: string): void => {
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    if (!path) return;
    void onWorkspaceDataChanged();
  }, [beginWorkspaceRequest, onWorkspaceDataChanged]);
}
