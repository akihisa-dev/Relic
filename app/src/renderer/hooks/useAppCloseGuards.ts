import { useCallback } from "react";

import { useEditorStore, type PaneId } from "../store/editorStore";
import { flushPendingEditorChanges } from "../editorInputBuffer";
import { matchesAnyTreeItemPath } from "./workspaceFileActionHelpers";

interface UseAppCloseGuardsInput {
  focusedPane: PaneId;
  flushTabsBeforeClose: (tabIds: string[]) => Promise<{ message?: string; ok: boolean }>;
  saveFailedMessage: string;
  setWorkspaceError: (message: string | null) => void;
}

export function useAppCloseGuards({
  focusedPane,
  flushTabsBeforeClose,
  saveFailedMessage,
  setWorkspaceError
}: UseAppCloseGuardsInput): {
  ensureCanCloseAllTabs: () => Promise<boolean> | boolean;
  ensureCanCloseTabs: (_pane: PaneId, tabIds: string[]) => Promise<boolean> | boolean;
  ensureCanMutateWorkspaceItems: (items: Array<{ path: string; type: "file" | "folder" }>) => Promise<boolean> | boolean;
} {
  const ensureCanCloseTabs = useCallback((_pane: PaneId, tabIds: string[]): Promise<boolean> | boolean => {
    flushPendingEditorChanges(tabIds);
    const currentTabs = useEditorStore.getState().tabs;
    const needsSaveCheck = tabIds.some((tabId) => {
      const tab = currentTabs[tabId];
      return tab?.kind === "file" && (Boolean(tab.externalConflict) || tab.content !== tab.savedContent);
    });

    if (!needsSaveCheck) return true;

    return (async () => {
      const result = await flushTabsBeforeClose(tabIds);
      if (!result.ok) {
        setWorkspaceError(result.message ?? saveFailedMessage);
        return false;
      }

      return true;
    })();
  }, [flushTabsBeforeClose, saveFailedMessage, setWorkspaceError]);

  const ensureCanCloseAllTabs = useCallback((): Promise<boolean> | boolean => {
    flushPendingEditorChanges();
    const currentTabs = useEditorStore.getState().tabs;
    const tabIds = Object.keys(currentTabs);
    const needsSaveCheck = Object.values(currentTabs).some((tab) => {
      return tab.kind === "file" && (Boolean(tab.externalConflict) || tab.content !== tab.savedContent);
    });

    if (!needsSaveCheck) return true;

    return (async () => {
      const result = await flushTabsBeforeClose(tabIds);
      if (!result.ok) {
        setWorkspaceError(result.message ?? saveFailedMessage);
        return false;
      }

      return true;
    })();
  }, [flushTabsBeforeClose, saveFailedMessage, setWorkspaceError]);

  const ensureCanMutateWorkspaceItems = useCallback((
    items: Array<{ path: string; type: "file" | "folder" }>
  ): Promise<boolean> | boolean => {
    const currentTabs = useEditorStore.getState().tabs;
    const targetTabIds = Object.entries(currentTabs).reduce<string[]>((acc, [tabId, tab]) => {
      if (tab.kind === "file" && matchesAnyTreeItemPath(tab.path, items)) acc.push(tabId);
      return acc;
    }, []);

    if (targetTabIds.length === 0) return true;
    return ensureCanCloseTabs(focusedPane, targetTabIds);
  }, [ensureCanCloseTabs, focusedPane]);

  return {
    ensureCanCloseAllTabs,
    ensureCanCloseTabs,
    ensureCanMutateWorkspaceItems
  };
}
