import { relicClient } from "../relicClient";
import { useEffect, useState } from "react";

import type { Backlink, WorkspaceTreeNode } from "../../shared/ipc";

interface UseBacklinksStateInput {
  activeFilePath: string | null;
  enabled: boolean;
  fileTree: WorkspaceTreeNode[] | undefined;
  setWorkspaceError: (message: string | null) => void;
}

const emptyBacklinks: Backlink[] = [];

export function useBacklinksState({
  activeFilePath,
  enabled,
  fileTree,
  setWorkspaceError
}: UseBacklinksStateInput) {
  const [backlinkState, setBacklinkState] = useState<{ backlinks: Backlink[]; path: string | null }>({
    backlinks: emptyBacklinks,
    path: null
  });
  const hasActiveFile = Boolean(enabled && activeFilePath && relicClient.current);

  useEffect(() => {
    if (!enabled || !activeFilePath || !relicClient.current) {
      return;
    }

    let canceled = false;

    void relicClient.current
      .getBacklinks({ path: activeFilePath })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setBacklinkState({ backlinks: result.value, path: activeFilePath });
        } else {
          setBacklinkState({ backlinks: emptyBacklinks, path: activeFilePath });
          setWorkspaceError(result.error.message);
        }
      });

    return () => {
      canceled = true;
    };
  }, [activeFilePath, enabled, fileTree, setWorkspaceError]);

  return {
    backlinks: hasActiveFile && backlinkState.path === activeFilePath ? backlinkState.backlinks : emptyBacklinks,
    isLoadingBacklinks: hasActiveFile && backlinkState.path !== activeFilePath
  };
}
