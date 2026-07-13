import { relicClient } from "../relicClient";
import { useCallback, useEffect } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { PaneState, Tab } from "../store/editorStore";
import { useEditorStore, type PaneId } from "../store/editorStore";
import { collectMarkdownPaths } from "../workspacePaths";
import type { Translator } from "../i18nModel";

interface UseWorkspaceExternalRefreshInput {
  closeTab: (pane: PaneId, tabId: string) => void;
  leftPane: PaneState;
  markTabSaved: (tabId: string, content: string) => void;
  rightPane: PaneState;
  setTabExternalConflict: (tabId: string, content: string) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  t: Translator;
  tabs: Record<string, Tab>;
  updateTabFromExternal: (tabId: string, content: string) => void;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceExternalRefresh({
  closeTab,
  leftPane,
  markTabSaved,
  rightPane,
  setTabExternalConflict,
  setWorkspaceError,
  setWorkspaceState,
  tabs,
  t,
  updateTabFromExternal,
  workspaceState
}: UseWorkspaceExternalRefreshInput): void {
  const refreshWorkspaceAfterExternalChange = useCallback(
    async (workspaceId: string): Promise<void> => {
      const relic = relicClient.current;
      if (!relic) return;
      if (workspaceState?.activeWorkspace?.id && workspaceState.activeWorkspace.id !== workspaceId) return;

      const result = await relic.getWorkspaceState();
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }

      if (result.value.activeWorkspace?.id !== workspaceId) return;

      const nextFilePaths = collectMarkdownPaths(result.value.fileTree);
      const nextFilePathSet = new Set(nextFilePaths);
      const protectedMissingTabIds = new Set<string>();

      const closeMissingTabIfSafe = (pane: PaneId, tabId: string): void => {
        const tab = tabs[tabId];
        if (tab?.kind !== "file" || nextFilePathSet.has(tab.path)) return;

        if (tab.content === tab.savedContent && !tab.externalConflict) {
          closeTab(pane, tabId);
          return;
        }

        if (protectedMissingTabIds.has(tabId)) return;
        protectedMissingTabIds.add(tabId);
        setWorkspaceError(t("pane.missingDirtyTabToast", { name: tab.name }));
      };

      for (const tabId of leftPane.tabIds) {
        closeMissingTabIfSafe("left", tabId);
      }

      for (const tabId of rightPane.tabIds) {
        closeMissingTabIfSafe("right", tabId);
      }

      const openFileEntries = Object.entries(tabs).reduce<Array<{ path: string; tabId: string }>>((acc, [tabId, tab]) => {
        if (tab.kind === "file" && nextFilePathSet.has(tab.path)) acc.push({ path: tab.path, tabId });
        return acc;
      }, []);
      const fileResults = await Promise.all(
        openFileEntries.map(async ({ path, tabId }) => ({
          fileResult: await relic.readMarkdownFile({ path }),
          tabId
        }))
      );

      for (const { fileResult, tabId } of fileResults) {
        if (!fileResult.ok) {
          setWorkspaceError(fileResult.error.message);
          continue;
        }

        const currentTab = useEditorStore.getState().tabs[tabId];
        if (currentTab?.kind !== "file") continue;

        const externalContent = fileResult.value.content;

        if (externalContent === currentTab.savedContent) continue;

        if (externalContent === currentTab.content) {
          markTabSaved(tabId, externalContent);
          continue;
        }

        if (currentTab.content === currentTab.savedContent) {
          updateTabFromExternal(tabId, externalContent);
          continue;
        }

        const shouldNotify = currentTab.externalConflict?.content !== externalContent;
        setTabExternalConflict(tabId, externalContent);
        if (shouldNotify) {
          setWorkspaceError(t("pane.externalConflictToast", { name: currentTab.name }));
        }
      }

      setWorkspaceState(result.value);
    },
    [
      closeTab,
      leftPane.tabIds,
      markTabSaved,
      rightPane.tabIds,
      setTabExternalConflict,
      setWorkspaceError,
      setWorkspaceState,
      tabs,
      t,
      updateTabFromExternal,
      workspaceState?.activeWorkspace?.id
    ]
  );

  useEffect(() => {
    if (!relicClient.current?.onWorkspaceChanged) return undefined;

    return relicClient.current.onWorkspaceChanged((event) => {
      void refreshWorkspaceAfterExternalChange(event.workspaceId);
    });
  }, [refreshWorkspaceAfterExternalChange]);

  useEffect(() => {
    if (!relicClient.current?.onWorkspaceWatcherStatus) return undefined;

    return relicClient.current.onWorkspaceWatcherStatus((event) => {
      if (event.workspaceId !== workspaceState?.activeWorkspace?.id) return;
      setWorkspaceError(t("files.workspaceWatcherUnavailable"));
    });
  }, [setWorkspaceError, t, workspaceState?.activeWorkspace?.id]);
}
