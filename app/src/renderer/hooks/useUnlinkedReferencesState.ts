import { relicClient } from "../relicClient";
import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ApplyUnlinkedReferenceInput,
  UnlinkedReference,
  UnlinkedReferencesResult,
  WorkspaceTreeNode
} from "../../shared/ipc";
import type { Tab } from "../store/editorStore";

interface UseUnlinkedReferencesStateInput {
  activeFilePath: string | null;
  enabled: boolean;
  fileTree: WorkspaceTreeNode[] | undefined;
  setWorkspaceError: (message: string | null) => void;
  tabs: Record<string, Tab>;
  updateTabContent: (tabId: string, content: string) => void;
}

const emptyUnlinkedReferences: UnlinkedReferencesResult = {
  references: [],
  skippedUnreadableFileCount: 0,
  truncated: false
};

export function useUnlinkedReferencesState({
  activeFilePath,
  enabled,
  fileTree,
  setWorkspaceError,
  tabs,
  updateTabContent
}: UseUnlinkedReferencesStateInput) {
  const [state, setState] = useState<{ path: string | null; result: UnlinkedReferencesResult }>({
    path: null,
    result: emptyUnlinkedReferences
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [applyingReferenceKey, setApplyingReferenceKey] = useState<string | null>(null);
  const hasActiveFile = Boolean(enabled && activeFilePath && relicClient.current);

  useEffect(() => {
    if (!enabled || !activeFilePath || !relicClient.current) {
      return;
    }

    let canceled = false;

    void relicClient.current
      .getUnlinkedReferences({ path: activeFilePath })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setState({ path: activeFilePath, result: result.value });
        } else {
          setState({ path: activeFilePath, result: emptyUnlinkedReferences });
          setWorkspaceError(result.error.message);
        }
      });

    return () => {
      canceled = true;
    };
  }, [activeFilePath, enabled, fileTree, refreshKey, setWorkspaceError]);

  const openFileTabsByPath = useMemo(() => {
    const result = new Map<string, string[]>();

    for (const tab of Object.values(tabs)) {
      if (tab.kind !== "file") continue;
      result.set(tab.path, [...(result.get(tab.path) ?? []), tab.id]);
    }

    return result;
  }, [tabs]);

  const applyUnlinkedReference = useCallback(async (reference: UnlinkedReference): Promise<void> => {
    if (!relicClient.current) return;

    const input: ApplyUnlinkedReferenceInput = {
      from: reference.from,
      matchText: reference.matchText,
      sourcePath: reference.sourcePath,
      targetPath: reference.targetPath,
      to: reference.to
    };
    const key = unlinkedReferenceKey(reference);
    setApplyingReferenceKey(key);

    try {
      const result = await relicClient.current.applyUnlinkedReference(input);
      if (result.ok) {
        for (const tabId of openFileTabsByPath.get(result.value.sourcePath) ?? []) {
          updateTabContent(tabId, result.value.content);
        }
        setRefreshKey((current) => current + 1);
      } else {
        setWorkspaceError(result.error.message);
        setRefreshKey((current) => current + 1);
      }
    } finally {
      setApplyingReferenceKey(null);
    }
  }, [openFileTabsByPath, setWorkspaceError, updateTabContent]);

  return {
    applyingReferenceKey,
    isLoadingUnlinkedReferences: hasActiveFile && state.path !== activeFilePath,
    onApplyUnlinkedReference: applyUnlinkedReference,
    unlinkedReferences: hasActiveFile && state.path === activeFilePath ? state.result : emptyUnlinkedReferences
  };
}

export function unlinkedReferenceKey(reference: Pick<UnlinkedReference, "from" | "sourcePath" | "targetPath" | "to">): string {
  return `${reference.sourcePath}:${reference.from}-${reference.to}:${reference.targetPath}`;
}
