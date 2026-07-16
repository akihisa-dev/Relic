import { useEffect, useState } from "react";

import type { WorkspaceCard } from "../../shared/ipc";
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

type WorkspaceCardsSnapshot = WorkspaceCardsState & { requestKey: string };

export function useWorkspaceCardsState({
  loadFailedMessage,
  refreshRevision,
  workspaceId
}: UseWorkspaceCardsStateInput): WorkspaceCardsState {
  const requestKey = JSON.stringify([workspaceId, refreshRevision]);
  const [snapshot, setSnapshot] = useState<WorkspaceCardsSnapshot>({
    requestKey,
    status: "loading"
  });

  useEffect(() => {
    let active = true;

    void loadWorkspaceCards({ revision: refreshRevision, workspaceId }).then((result) => {
      if (!active) return;
      setSnapshot(result.ok
        ? { requestKey, status: "ready", cards: result.value }
        : { requestKey, status: "error", message: result.error.message });
    }).catch(() => {
      if (active) {
        setSnapshot({ requestKey, status: "error", message: loadFailedMessage });
      }
    });

    return () => {
      active = false;
    };
  }, [loadFailedMessage, refreshRevision, requestKey, workspaceId]);

  return snapshot.requestKey === requestKey ? snapshot : { status: "loading" };
}
