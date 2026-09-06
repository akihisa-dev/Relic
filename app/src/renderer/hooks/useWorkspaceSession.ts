import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import { WorkspaceSession, type WorkspaceRequestGuard } from "../workspaceSession";

export function useWorkspaceSession(initialState: WorkspaceState | null = null) {
  const [session] = useState(() => new WorkspaceSession(initialState));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const workspaceId = snapshot.workspaceState?.activeWorkspace?.id ?? null;
  const beginWorkspaceRequest = useCallback(
    () => session.beginWorkspaceRequestFor(workspaceId),
    [session, workspaceId]
  );

  useEffect(() => () => session.invalidateWorkspaceRequests(), [session]);

  const workspaceRequestGuard: WorkspaceRequestGuard = {
    beginWorkspaceRequest,
    beginWorkspaceRequestFor: session.beginWorkspaceRequestFor,
    invalidateWorkspaceRequests: session.invalidateWorkspaceRequests
  };

  return {
    ...snapshot,
    ...workspaceRequestGuard,
    markWorkspaceDataChanged: session.markWorkspaceDataChanged,
    setWorkspaceState: session.setWorkspaceState,
    workspaceRequestGuard
  };
}
