import { useEffect, useState } from "react";

import type { Backlink, CardbookTreeNode } from "../../shared/ipc";

interface UseBacklinksStateInput {
  activeCardPath: string | null;
  cardTree: CardbookTreeNode[] | undefined;
  setCardbookError: (message: string | null) => void;
}

export function useBacklinksState({
  activeCardPath,
  cardTree,
  setCardbookError
}: UseBacklinksStateInput) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);

  useEffect(() => {
    if (!activeCardPath || !window.relic) {
      setBacklinks([]);
      return;
    }

    let canceled = false;
    setIsLoadingBacklinks(true);

    void window.relic
      .getBacklinks({ path: activeCardPath })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setBacklinks(result.value);
        } else {
          setBacklinks([]);
          setCardbookError(result.error.message);
        }
      })
      .finally(() => {
        if (!canceled) setIsLoadingBacklinks(false);
      });

    return () => {
      canceled = true;
    };
  }, [activeCardPath, cardTree, setCardbookError]);

  return {
    backlinks,
    isLoadingBacklinks
  };
}
