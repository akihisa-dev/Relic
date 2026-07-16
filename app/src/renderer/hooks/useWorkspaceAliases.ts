import { relicClient } from "../relicClient";
import { useEffect, useState } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";

interface UseWorkspaceAliasesInput {
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceAliases({
  setWorkspaceError,
  workspaceState
}: UseWorkspaceAliasesInput): AliasIndex {
  const workspaceId = workspaceState?.activeWorkspace?.id ?? null;
  const [snapshot, setSnapshot] = useState<{ aliasesByPath: AliasIndex; workspaceId: string } | null>(null);

  useEffect(() => {
    const client = relicClient.current;
    if (!workspaceId || !client) {
      return;
    }

    let canceled = false;

    void client.getWorkspaceAliases().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setSnapshot({ aliasesByPath: result.value, workspaceId });
      } else {
        setSnapshot({ aliasesByPath: {}, workspaceId });
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceId, workspaceState?.fileTree]);

  return workspaceId && snapshot?.workspaceId === workspaceId ? snapshot.aliasesByPath : {};
}
