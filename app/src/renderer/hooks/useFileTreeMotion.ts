import { useEffect, useRef, useState } from "react";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { addedNodePaths, collectNodePaths } from "../fileTreeModel";

export function useFileTreeMotion(nodes: WorkspaceTreeNode[], motionPaths?: Set<string>): Set<string> {
  const previousPathsRef = useRef<Set<string> | null>(null);
  const [appearingPaths, setAppearingPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const nextPaths = collectNodePaths(nodes);
    const addedPaths = previousPathsRef.current ? addedNodePaths(previousPathsRef.current, nodes) : new Set<string>();
    previousPathsRef.current = nextPaths;

    if (addedPaths.size === 0) return;

    setAppearingPaths(addedPaths);
    const timeout = window.setTimeout(() => setAppearingPaths(new Set()), 260);

    return () => window.clearTimeout(timeout);
  }, [nodes]);

  return motionPaths ?? appearingPaths;
}
