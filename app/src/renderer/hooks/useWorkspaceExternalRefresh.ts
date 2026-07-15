import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import { useEditorStore } from "../store/editorStore";
import { collectMarkdownPaths } from "../workspacePaths";
import { useLatest } from "./useLatest";

interface SaveBeforeRefreshResult {
  message?: string;
  ok: boolean;
}

interface UseWorkspaceExternalRefreshInput {
  flushTabsBeforeClose: (tabIds: string[]) => Promise<SaveBeforeRefreshResult>;
  onWorkspaceDataChanged: () => Promise<boolean>;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  showToast: (message: string, type?: "error" | "info") => void;
  t: Translator;
  workspaceState: WorkspaceState | null;
}

interface ApplyWorkspaceSnapshotResult {
  applied: boolean;
  derivedDataUpdated: boolean;
  failedFileCount: number;
}

export function useWorkspaceExternalRefresh({
  flushTabsBeforeClose,
  onWorkspaceDataChanged,
  setWorkspaceError,
  setWorkspaceState,
  showToast,
  t,
  workspaceState
}: UseWorkspaceExternalRefreshInput): {
  isRefreshingWorkspace: boolean;
  refreshWorkspace: () => void;
} {
  const [isRefreshingWorkspace, setIsRefreshingWorkspace] = useState(false);
  const manualRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const externalRefreshPromiseRef = useRef<Promise<void> | null>(null);
  const queuedExternalWorkspaceIdRef = useRef<string | null>(null);
  const activeWorkspaceIdRef = useLatest(workspaceState?.activeWorkspace?.id ?? null);
  const onWorkspaceDataChangedRef = useLatest(onWorkspaceDataChanged);

  const applyWorkspaceSnapshot = useCallback(async (
    nextState: WorkspaceState,
    workspaceId: string,
    notifyFileFailures: boolean
  ): Promise<ApplyWorkspaceSnapshotResult> => {
    const relic = relicClient.current;
    if (!relic || nextState.activeWorkspace?.id !== workspaceId) {
      return { applied: false, derivedDataUpdated: true, failedFileCount: 0 };
    }

    const nextFilePathSet = new Set(collectMarkdownPaths(nextState.fileTree));
    const protectedMissingTabIds = new Set<string>();
    const editorState = useEditorStore.getState();

    const closeMissingTabIfSafe = (pane: "left" | "right", tabId: string): void => {
      const tab = useEditorStore.getState().tabs[tabId];
      if (tab?.kind !== "file" || nextFilePathSet.has(tab.path)) return;

      if (tab.content === tab.savedContent && !tab.externalConflict) {
        useEditorStore.getState().closeTab(pane, tabId);
        return;
      }

      if (protectedMissingTabIds.has(tabId)) return;
      protectedMissingTabIds.add(tabId);
      setWorkspaceError(t("pane.missingDirtyTabToast", { name: tab.name }));
    };

    for (const tabId of editorState.leftPane.tabIds) closeMissingTabIfSafe("left", tabId);
    for (const tabId of editorState.rightPane.tabIds) closeMissingTabIfSafe("right", tabId);

    const openFileEntries = Object.entries(useEditorStore.getState().tabs).flatMap(([tabId, tab]) =>
      tab.kind === "file" && nextFilePathSet.has(tab.path)
        ? [{ path: tab.path, tabId }]
        : []
    );
    const fileResults = await Promise.all(openFileEntries.map(async ({ path, tabId }) => ({
      fileResult: await relic.readMarkdownFile({ path }),
      tabId
    })));

    if (activeWorkspaceIdRef.current !== workspaceId) {
      return { applied: false, derivedDataUpdated: true, failedFileCount: 0 };
    }

    let failedFileCount = 0;
    for (const { fileResult, tabId } of fileResults) {
      if (!fileResult.ok) {
        failedFileCount += 1;
        if (notifyFileFailures) setWorkspaceError(fileResult.error.message);
        continue;
      }

      const currentTab = useEditorStore.getState().tabs[tabId];
      if (currentTab?.kind !== "file") continue;
      const externalContent = fileResult.value.content;

      if (externalContent === currentTab.savedContent) continue;
      if (externalContent === currentTab.content) {
        useEditorStore.getState().markTabSaved(tabId, externalContent);
        continue;
      }
      if (currentTab.content === currentTab.savedContent) {
        useEditorStore.getState().updateTabFromExternal(tabId, externalContent);
        continue;
      }

      const shouldNotify = currentTab.externalConflict?.content !== externalContent;
      useEditorStore.getState().setTabExternalConflict(tabId, externalContent);
      if (shouldNotify) setWorkspaceError(t("pane.externalConflictToast", { name: currentTab.name }));
    }

    if (activeWorkspaceIdRef.current !== workspaceId) {
      return { applied: false, derivedDataUpdated: true, failedFileCount };
    }

    setWorkspaceState(nextState);
    const derivedDataUpdated = await onWorkspaceDataChangedRef.current();
    return {
      applied: true,
      derivedDataUpdated,
      failedFileCount
    };
  }, [activeWorkspaceIdRef, onWorkspaceDataChangedRef, setWorkspaceError, setWorkspaceState, t]);

  const runExternalRefresh = useCallback((workspaceId: string): void => {
    if (manualRefreshPromiseRef.current) {
      queuedExternalWorkspaceIdRef.current = workspaceId;
      return;
    }
    if (externalRefreshPromiseRef.current) {
      queuedExternalWorkspaceIdRef.current = workspaceId;
      return;
    }

    const promise = (async () => {
      const relic = relicClient.current;
      if (!relic || activeWorkspaceIdRef.current !== workspaceId) return;
      const result = await relic.getWorkspaceState();
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }
      await applyWorkspaceSnapshot(result.value, workspaceId, true);
    })().finally(() => {
      externalRefreshPromiseRef.current = null;
      const queuedWorkspaceId = queuedExternalWorkspaceIdRef.current;
      queuedExternalWorkspaceIdRef.current = null;
      if (queuedWorkspaceId) runExternalRefresh(queuedWorkspaceId);
    });
    externalRefreshPromiseRef.current = promise;
  }, [activeWorkspaceIdRef, applyWorkspaceSnapshot, setWorkspaceError]);

  const refreshWorkspace = useCallback((): void => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId || manualRefreshPromiseRef.current) return;

    setIsRefreshingWorkspace(true);
    const promise = (async () => {
      if (externalRefreshPromiseRef.current) await externalRefreshPromiseRef.current;
      if (activeWorkspaceIdRef.current !== workspaceId) return;

      const tabIds = Object.keys(useEditorStore.getState().tabs);
      const saveResult = await flushTabsBeforeClose(tabIds);
      if (!saveResult.ok) {
        showToast(saveResult.message ?? t("refresh.saveFailed"), "error");
        return;
      }

      const relic = relicClient.current;
      if (!relic || activeWorkspaceIdRef.current !== workspaceId) return;
      const result = await relic.refreshWorkspace({ workspaceId });
      if (!result.ok) {
        if (result.error.code !== "WORKSPACE_REFRESH_STALE") {
          showToast(result.error.message, "error");
        }
        return;
      }

      const applied = await applyWorkspaceSnapshot(result.value, workspaceId, false);
      if (!applied.applied) return;
      if (applied.failedFileCount > 0 || !applied.derivedDataUpdated) {
        const message = applied.failedFileCount > 0 && !applied.derivedDataUpdated
          ? t("refresh.partialFailureBoth", { count: applied.failedFileCount })
          : applied.failedFileCount > 0
            ? t("refresh.openFilesFailed", { count: applied.failedFileCount })
            : t("refresh.derivedDataFailed");
        showToast(message, "error");
        return;
      }
      showToast(t("refresh.completed"), "info");
    })().catch((error) => {
      void error;
      showToast(t("refresh.failed"), "error");
    }).finally(() => {
      manualRefreshPromiseRef.current = null;
      setIsRefreshingWorkspace(false);
      const queuedWorkspaceId = queuedExternalWorkspaceIdRef.current;
      queuedExternalWorkspaceIdRef.current = null;
      if (queuedWorkspaceId) runExternalRefresh(queuedWorkspaceId);
    });
    manualRefreshPromiseRef.current = promise;
  }, [
    activeWorkspaceIdRef,
    applyWorkspaceSnapshot,
    flushTabsBeforeClose,
    runExternalRefresh,
    showToast,
    t
  ]);

  useEffect(() => {
    if (!relicClient.current?.onWorkspaceChanged) return undefined;
    return relicClient.current.onWorkspaceChanged((event) => runExternalRefresh(event.workspaceId));
  }, [runExternalRefresh]);

  useEffect(() => {
    if (!relicClient.current?.onWorkspaceWatcherStatus) return undefined;
    return relicClient.current.onWorkspaceWatcherStatus((event) => {
      if (event.workspaceId !== activeWorkspaceIdRef.current) return;
      setWorkspaceError(t("files.workspaceWatcherUnavailable"));
    });
  }, [activeWorkspaceIdRef, setWorkspaceError, t]);

  return { isRefreshingWorkspace, refreshWorkspace };
}
