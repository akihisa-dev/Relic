import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceState } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import { relicClient } from "../relicClient";
import { useEditorStore } from "../store/editorStore";
import { applyWorkspaceSnapshot } from "../workspaceSnapshotSync";
import { applyWorkspacePaths } from "../workspaceSnapshotSync";
import { WorkspaceChangeCoordinator, type WorkspaceChangeAction } from "../workspaceChangeCoordinator";
import type { IsCurrentRequest } from "./useAsyncRequestGuard";
import { useLatest } from "./useLatest";
import type { WorkspaceRequestGuard } from "../workspaceSession";

interface SaveBeforeRefreshResult {
  message?: string;
  ok: boolean;
}

interface UseWorkspaceExternalRefreshInput extends Pick<WorkspaceRequestGuard, "beginWorkspaceRequestFor"> {
  flushTabsBeforeClose: (tabIds: string[]) => Promise<SaveBeforeRefreshResult>;
  onWorkspaceDataChanged: () => Promise<boolean>;
  onWorkspacePathsChanged: () => Promise<boolean>;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  showToast: (message: string, type?: "error" | "info") => void;
  t: Translator;
  workspaceState: WorkspaceState | null;
}

export function useWorkspaceExternalRefresh({
  beginWorkspaceRequestFor,
  flushTabsBeforeClose,
  onWorkspaceDataChanged,
  onWorkspacePathsChanged,
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
  const queuedExternalChangeRef = useRef<WorkspaceChangeAction | null>(null);
  const changeCoordinatorRef = useRef<WorkspaceChangeCoordinator | null>(null);
  changeCoordinatorRef.current ??= new WorkspaceChangeCoordinator();
  const activeWorkspaceIdRef = useLatest(workspaceState?.activeWorkspace?.id ?? null);
  const onWorkspaceDataChangedRef = useLatest(onWorkspaceDataChanged);

  const applyCurrentWorkspaceSnapshot = useCallback(async (
    nextState: WorkspaceState,
    workspaceId: string,
    notifyFileFailures: boolean,
    isCurrentWorkspace: IsCurrentRequest
  ) => {
    return applyWorkspaceSnapshot({
      getActiveWorkspaceId: () => activeWorkspaceIdRef.current,
      isCurrentWorkspace,
      nextState,
      notifyFileFailures,
      onWorkspaceDataChanged: () => onWorkspaceDataChangedRef.current(),
      setWorkspaceError,
      setWorkspaceState,
      t,
      workspaceId
    });
  }, [activeWorkspaceIdRef, onWorkspaceDataChangedRef, setWorkspaceError, setWorkspaceState, t]);

  const queueExternalChange = useCallback((action: WorkspaceChangeAction): void => {
    const queued = queuedExternalChangeRef.current;
    if (!queued || queued.workspaceId !== action.workspaceId) {
      queuedExternalChangeRef.current = action;
      return;
    }
    if (queued.kind === "full" || action.kind === "full") {
      queuedExternalChangeRef.current = {
        kind: "full",
        revision: Math.max(queued.revision, action.revision),
        workspaceId: action.workspaceId
      };
      return;
    }
    queuedExternalChangeRef.current = {
      kind: "paths",
      paths: [...new Set([...queued.paths, ...action.paths])].toSorted(),
      revision: Math.max(queued.revision, action.revision),
      workspaceId: action.workspaceId
    };
  }, []);

  const runExternalRefresh = useCallback((action: WorkspaceChangeAction): void => {
    const workspaceId = action.workspaceId;
    if (manualRefreshPromiseRef.current) {
      queueExternalChange(action);
      return;
    }
    if (externalRefreshPromiseRef.current) {
      queueExternalChange(action);
      return;
    }

    const promise = (async () => {
      const isCurrentWorkspace = beginWorkspaceRequestFor(workspaceId);
      if (!isCurrentWorkspace()) return;
      const relic = relicClient.current;
      if (!relic || activeWorkspaceIdRef.current !== workspaceId) return;

      if (action.kind === "paths") {
        const applied = await applyWorkspacePaths({
          conflictMessage: (name) => t("pane.externalConflictToast", { name }),
          getActiveWorkspaceId: () => activeWorkspaceIdRef.current,
          isCurrentWorkspace,
          paths: action.paths,
          setWorkspaceError,
          workspaceId
        });
        if (!applied.applied || !isCurrentWorkspace()) return;
        const derivedDataUpdated = await onWorkspacePathsChanged();
        if (!isCurrentWorkspace() || !derivedDataUpdated) {
          if (isCurrentWorkspace() && applied.failedFileCount === 0) {
            setWorkspaceError(t("refresh.derivedDataFailed"));
          }
          return;
        }
        return;
      }

      const result = await relic.getWorkspaceState();
      if (!isCurrentWorkspace()) return;
      if (!result.ok) {
        setWorkspaceError(result.error.message);
        return;
      }
      await applyCurrentWorkspaceSnapshot(result.value, workspaceId, true, isCurrentWorkspace);
    })().finally(() => {
      externalRefreshPromiseRef.current = null;
      const queuedChange = queuedExternalChangeRef.current;
      queuedExternalChangeRef.current = null;
      if (queuedChange) runExternalRefresh(queuedChange);
    });
    externalRefreshPromiseRef.current = promise;
  }, [activeWorkspaceIdRef, applyCurrentWorkspaceSnapshot, beginWorkspaceRequestFor, onWorkspacePathsChanged, queueExternalChange, setWorkspaceError, t]);

  const refreshWorkspace = useCallback((): void => {
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId || manualRefreshPromiseRef.current) return;
    const isCurrentWorkspace = beginWorkspaceRequestFor(workspaceId);
    if (!isCurrentWorkspace()) return;

    setIsRefreshingWorkspace(true);
    const promise = (async () => {
      if (externalRefreshPromiseRef.current) await externalRefreshPromiseRef.current;
      if (!isCurrentWorkspace() || activeWorkspaceIdRef.current !== workspaceId) return;

      const tabIds = Object.keys(useEditorStore.getState().tabs);
      const saveResult = await flushTabsBeforeClose(tabIds);
      if (!isCurrentWorkspace()) return;
      if (!saveResult.ok) {
        showToast(saveResult.message ?? t("refresh.saveFailed"), "error");
        return;
      }

      const relic = relicClient.current;
      if (!relic || activeWorkspaceIdRef.current !== workspaceId) return;
      const result = await relic.refreshWorkspace({ workspaceId });
      if (!isCurrentWorkspace()) return;
      if (!result.ok) {
        if (result.error.code !== "WORKSPACE_REFRESH_STALE") {
          showToast(result.error.message, "error");
        }
        return;
      }

      const applied = await applyCurrentWorkspaceSnapshot(
        result.value,
        workspaceId,
        false,
        isCurrentWorkspace
      );
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
    })().catch(() => {
      if (!isCurrentWorkspace()) return;
      showToast(t("refresh.failed"), "error");
    }).finally(() => {
      manualRefreshPromiseRef.current = null;
      setIsRefreshingWorkspace(false);
      const queuedChange = queuedExternalChangeRef.current;
      queuedExternalChangeRef.current = null;
      if (queuedChange) runExternalRefresh(queuedChange);
    });
    manualRefreshPromiseRef.current = promise;
  }, [
    activeWorkspaceIdRef,
    applyCurrentWorkspaceSnapshot,
    beginWorkspaceRequestFor,
    flushTabsBeforeClose,
    runExternalRefresh,
    showToast,
    t
  ]);

  useEffect(() => {
    if (!relicClient.current?.onWorkspaceChanged) return undefined;
    return relicClient.current.onWorkspaceChanged((event) => {
      const action = changeCoordinatorRef.current?.accept(event, activeWorkspaceIdRef.current);
      if (action) runExternalRefresh(action);
    });
  }, [activeWorkspaceIdRef, runExternalRefresh]);

  useEffect(() => {
    if (!relicClient.current?.onWorkspaceWatcherStatus) return undefined;
    return relicClient.current.onWorkspaceWatcherStatus((event) => {
      const isCurrentWorkspace = beginWorkspaceRequestFor(event.workspaceId);
      if (!isCurrentWorkspace()) return;
      if (event.workspaceId !== activeWorkspaceIdRef.current) return;
      setWorkspaceError(t("files.workspaceWatcherUnavailable"));
    });
  }, [activeWorkspaceIdRef, beginWorkspaceRequestFor, setWorkspaceError, t]);

  return { isRefreshingWorkspace, refreshWorkspace };
}
