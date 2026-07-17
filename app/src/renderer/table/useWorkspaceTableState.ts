import { useEffect, useState } from "react";

import type { WorkspaceTable } from "../../shared/ipc";
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
  const requestKey = JSON.stringify([input.workspaceId, input.refreshRevision]);
  const [snapshot, setSnapshot] = useState<WorkspaceTableState & { requestKey: string }>({
    requestKey,
    status: "loading"
  });

  useEffect(() => {
    let active = true;
    void loadWorkspaceTable({ revision: input.refreshRevision, workspaceId: input.workspaceId }).then((result) => {
      if (!active) return;
      setSnapshot(result.ok
        ? { requestKey, status: "ready", table: result.value }
        : { requestKey, status: "error", message: result.error.message });
    }).catch(() => {
      if (active) setSnapshot({ requestKey, status: "error", message: input.loadFailedMessage });
    });

    return () => {
      active = false;
    };
  }, [input.loadFailedMessage, input.refreshRevision, input.workspaceId, requestKey]);

  return snapshot.requestKey === requestKey ? snapshot : { status: "loading" };
}
