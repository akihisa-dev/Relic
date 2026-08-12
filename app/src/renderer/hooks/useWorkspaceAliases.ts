import { relicClient } from "../relicClient";
import { useEffect, useState } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { AliasIndex } from "../../shared/links";
import { useT } from "../i18n";

interface UseWorkspaceAliasesInput {
  setWorkspaceError: (message: string | null) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceAliases({
  setWorkspaceError,
  workspaceState
}: UseWorkspaceAliasesInput): AliasIndex {
  const t = useT();
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
    }).catch(() => {
      if (canceled) return;
      setSnapshot({ aliasesByPath: {}, workspaceId });
      setWorkspaceError(t("errors.operationFailed"));
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, t, workspaceId, workspaceState?.fileTree]);

  return workspaceId && snapshot?.workspaceId === workspaceId ? snapshot.aliasesByPath : {};
}
