import { useEffect, useState } from "react";

import type { RelicResult } from "../../shared/result";
import type { WorkspaceResourceRequest } from "../workspaceResourceLoader";

export type WorkspaceResourceState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; value: T };

interface UseWorkspaceResourceStateInput<T> extends WorkspaceResourceRequest {
  available?: boolean;
  loadFailedMessage: string;
  loadResource: (request: WorkspaceResourceRequest) => Promise<RelicResult<T>>;
}

type WorkspaceResourceSnapshot<T> = WorkspaceResourceState<T> & { requestKey: string };

export function useWorkspaceResourceState<T>({
  available = true,
  loadFailedMessage,
  loadResource,
  revision,
  workspaceId
}: UseWorkspaceResourceStateInput<T>): WorkspaceResourceState<T> {
  const requestKey = JSON.stringify([workspaceId, revision]);
  const [snapshot, setSnapshot] = useState<WorkspaceResourceSnapshot<T>>(() => available
    ? { requestKey, status: "loading" }
    : { requestKey, status: "error", message: loadFailedMessage });

  useEffect(() => {
    let active = true;
    if (!available) {
      return () => {
        active = false;
      };
    }

    void loadResource({ revision, workspaceId }).then((result) => {
      if (!active) return;
      setSnapshot(result.ok
        ? { requestKey, status: "ready", value: result.value }
        : { requestKey, status: "error", message: result.error.message });
    }).catch(() => {
      if (active) setSnapshot({ requestKey, status: "error", message: loadFailedMessage });
    });

    return () => {
      active = false;
    };
  }, [available, loadFailedMessage, loadResource, requestKey, revision, workspaceId]);

  if (snapshot.requestKey === requestKey) return snapshot;
  return available ? { status: "loading" } : { status: "error", message: loadFailedMessage };
}
