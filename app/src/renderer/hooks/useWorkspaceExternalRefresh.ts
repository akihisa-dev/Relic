import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import { useEditorStore } from "../store/editorStore";
import { applyWorkspaceSnapshot } from "../workspaceSnapshotSync";
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

  const applyCurrentWorkspaceSnapshot = useCallback(async (
    nextState: WorkspaceState,
    workspaceId: string,
    notifyFileFailures: boolean
  ) => {
    return applyWorkspaceSnapshot({
      getActiveWorkspaceId: () => activeWorkspaceIdRef.current,
      nextState,
      notifyFileFailures,
      onWorkspaceDataChanged: () => onWorkspaceDataChangedRef.current(),
      setWorkspaceError,
      setWorkspaceState,
      t,
      workspaceId
    });
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
      await applyCurrentWorkspaceSnapshot(result.value, workspaceId, true);
    })().finally(() => {
      externalRefreshPromiseRef.current = null;
      const queuedWorkspaceId = queuedExternalWorkspaceIdRef.current;
      queuedExternalWorkspaceIdRef.current = null;
      if (queuedWorkspaceId) runExternalRefresh(queuedWorkspaceId);
    });
    externalRefreshPromiseRef.current = promise;
  }, [activeWorkspaceIdRef, applyCurrentWorkspaceSnapshot, setWorkspaceError]);

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

      const applied = await applyCurrentWorkspaceSnapshot(result.value, workspaceId, false);
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
    applyCurrentWorkspaceSnapshot,
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
