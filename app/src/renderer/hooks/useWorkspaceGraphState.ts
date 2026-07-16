import { useEffect, useState } from "react";

import type { WorkspaceGraph } from "../../shared/ipc";
import { relicClient } from "../relicClient";
import { loadWorkspaceGraph } from "../graph/workspaceGraphLoader";

interface WorkspaceGraphState {
  error: string | null;
  graph: WorkspaceGraph | null;
  loading: boolean;
}

interface UseWorkspaceGraphStateOptions {
  loadFailedMessage: string;
  refreshRevision: number;
  workspaceCacheKey: string;
}

export function useWorkspaceGraphState({
  loadFailedMessage,
  refreshRevision,
  workspaceCacheKey
}: UseWorkspaceGraphStateOptions): WorkspaceGraphState {
  const [graphState, setGraphState] = useState<WorkspaceGraphState>(() => relicClient.current
    ? { error: null, graph: null, loading: true }
    : { error: loadFailedMessage, graph: null, loading: false });

  useEffect(() => {
    let active = true;

    if (!relicClient.current) {
      return () => {
        active = false;
      };
    }

    void loadWorkspaceGraph({ revision: refreshRevision, workspaceId: workspaceCacheKey }).then((result) => {
      if (!active) return;

      if (result.ok) {
        setGraphState({ error: null, graph: result.value, loading: false });
        return;
      }

      setGraphState({ error: result.error.message, graph: null, loading: false });
    }).catch(() => {
      if (!active) return;
      setGraphState({ error: loadFailedMessage, graph: null, loading: false });
    });

    return () => {
      active = false;
    };
  }, [loadFailedMessage, refreshRevision, workspaceCacheKey]);

  return graphState;
}
