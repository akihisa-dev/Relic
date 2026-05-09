import { useEffect, useState } from "react";

import type { Backlink, WorkspaceTreeNode } from "../../shared/ipc";

interface UseBacklinksStateInput {
  activeFilePath: string | null;
  fileTree: WorkspaceTreeNode[] | undefined;
  setWorkspaceError: (message: string | null) => void;
}

export function useBacklinksState({
  activeFilePath,
  fileTree,
  setWorkspaceError
}: UseBacklinksStateInput) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);

  useEffect(() => {
    if (!activeFilePath || !window.relic) {
      setBacklinks([]);
      return;
    }

    let canceled = false;
    setIsLoadingBacklinks(true);

    void window.relic
      .getBacklinks({ path: activeFilePath })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setBacklinks(result.value);
        } else {
          setBacklinks([]);
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => {
        if (!canceled) setIsLoadingBacklinks(false);
      });

    return () => {
      canceled = true;
    };
  }, [activeFilePath, fileTree, setWorkspaceError]);

  return {
    backlinks,
    isLoadingBacklinks
  };
}
