import type { WorkspaceGraph } from "../../shared/ipc";
import { relicClient } from "../relicClient";
import { loadWorkspaceGraph } from "../graph/workspaceGraphLoader";
import { useWorkspaceResourceState } from "./useWorkspaceResourceState";

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
  const state = useWorkspaceResourceState({
    available: Boolean(relicClient.current),
    loadFailedMessage,
    loadResource: loadWorkspaceGraph,
    revision: refreshRevision,
    workspaceId: workspaceCacheKey
  });

  if (state.status === "ready") return { error: null, graph: state.value, loading: false };
  if (state.status === "error") return { error: state.message, graph: null, loading: false };
  return { error: null, graph: null, loading: true };
}
