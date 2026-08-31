import { useCallback, useRef, useState } from "react";

interface WorkspaceDataRevision {
  markWorkspaceDataChanged: (kind?: "full" | "paths") => void;
  workspaceStructureRevision: number;
  workspaceDataRevision: number;
}

export function useWorkspaceDataRevision(activeWorkspaceId: string | null): WorkspaceDataRevision {
  const [dataChangeRevision, setDataChangeRevision] = useState(0);
  const [structureChangeRevision, setStructureChangeRevision] = useState(0);
  const activationRef = useRef({
    hasEstablishedWorkspace: activeWorkspaceId !== null,
    revision: 0,
    workspaceId: activeWorkspaceId
  });
  const activation = activationRef.current;

  if (activation.workspaceId !== activeWorkspaceId) {
    const establishesFirstWorkspace = !activation.hasEstablishedWorkspace
      && activeWorkspaceId !== null;
    activationRef.current = {
      hasEstablishedWorkspace: activation.hasEstablishedWorkspace || activeWorkspaceId !== null,
      revision: establishesFirstWorkspace ? activation.revision : activation.revision + 1,
      workspaceId: activeWorkspaceId
    };
  }

  const markWorkspaceDataChanged = useCallback((kind: "full" | "paths" = "full"): void => {
    setDataChangeRevision((revision) => revision + 1);
    if (kind === "full") setStructureChangeRevision((revision) => revision + 1);
  }, []);

  return {
    markWorkspaceDataChanged,
    workspaceDataRevision: activationRef.current.revision + dataChangeRevision,
    workspaceStructureRevision: activationRef.current.revision + structureChangeRevision
  };
}
