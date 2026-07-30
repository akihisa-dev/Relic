import type { WorkspaceCard } from "../../shared/ipc";
import { useWorkspaceResourceState } from "../hooks/useWorkspaceResourceState";
import { loadWorkspaceCards } from "./workspaceCardsLoader";

export type WorkspaceCardsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cards: WorkspaceCard[] };

interface UseWorkspaceCardsStateInput {
  loadFailedMessage: string;
  refreshRevision: number;
  workspaceId: string;
}

export function useWorkspaceCardsState({
  loadFailedMessage,
  refreshRevision,
  workspaceId
}: UseWorkspaceCardsStateInput): WorkspaceCardsState {
  const state = useWorkspaceResourceState({
    loadFailedMessage,
    loadResource: loadWorkspaceCards,
    revision: refreshRevision,
    workspaceId
  });

  return state.status === "ready"
    ? { status: "ready", cards: state.value }
    : state;
}
