import type { WorkspaceTable } from "../../shared/ipc";
import { useWorkspaceResourceState } from "../hooks/useWorkspaceResourceState";
import { loadWorkspaceTable } from "./workspaceTableLoader";

export type WorkspaceTableState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; table: WorkspaceTable };

export function useWorkspaceTableState(input: {
  loadFailedMessage: string;
  refreshRevision: number;
  workspaceId: string;
}): WorkspaceTableState {
  const state = useWorkspaceResourceState({
    loadFailedMessage: input.loadFailedMessage,
    loadResource: loadWorkspaceTable,
    revision: input.refreshRevision,
    workspaceId: input.workspaceId
  });

  return state.status === "ready"
    ? { status: "ready", table: state.value }
    : state;
}
