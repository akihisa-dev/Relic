import { useEffect, useState } from "react";

import type { WorkspaceGraph } from "../../shared/ipc";
import { relicClient } from "../relicClient";
import { loadWorkspaceGraph } from "../graph/workspaceGraphLoader";

interface WorkspaceGraphState {
  error: string | null;
  graph: WorkspaceGraph | null;
  loading: boolean;
}

interface WorkspaceGraphSnapshot extends WorkspaceGraphState {
  requestKey: string;
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
  const requestKey = JSON.stringify([workspaceCacheKey, refreshRevision]);
  const [snapshot, setSnapshot] = useState<WorkspaceGraphSnapshot>(() => relicClient.current
    ? { error: null, graph: null, loading: true, requestKey }
    : { error: loadFailedMessage, graph: null, loading: false, requestKey });

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
        setSnapshot({ error: null, graph: result.value, loading: false, requestKey });
        return;
      }

      setSnapshot({ error: result.error.message, graph: null, loading: false, requestKey });
    }).catch(() => {
      if (!active) return;
      setSnapshot({ error: loadFailedMessage, graph: null, loading: false, requestKey });
    });

    return () => {
      active = false;
    };
  }, [loadFailedMessage, refreshRevision, requestKey, workspaceCacheKey]);

  if (snapshot.requestKey === requestKey) {
    return snapshot;
  }

  return relicClient.current
    ? { error: null, graph: null, loading: true }
    : { error: loadFailedMessage, graph: null, loading: false };
}
