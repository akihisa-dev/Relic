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
  const [aliasesByPath, setAliasesByPath] = useState<AliasIndex>({});

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setAliasesByPath({});
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceAliases().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setAliasesByPath(result.value);
      } else {
        setAliasesByPath({});
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  return aliasesByPath;
}
