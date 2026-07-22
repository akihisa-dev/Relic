import { relicClient } from "../relicClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FileTab, Tab } from "../store/editorStore";
import {
  initialEditorSaveStatuses,
  updateEditorSaveStatuses,
  type EditorSaveQueue as SaveQueue,
  type EditorSaveRequest as SaveRequest,
  type EditorSaveStatus
} from "../editorAutoSaveStatus";
import { flushPendingEditorChanges } from "../editorInputBuffer";
import { useEditorStore } from "../store/editorStore";
import { subscribeEditorTabChanges } from "../store/editorTabChangeEvents";
import { useLatest } from "./useLatest";

export type { EditorSaveStatus } from "../editorAutoSaveStatus";

interface UseEditorAutoSaveInput {
  conflictCloseBlockedMessage: string;
  onSaved?: (path: string) => void;
  onSaveError?: (message: string) => void;
  saveFailedMessage: string;
  /** @deprecated The hook subscribes directly to changed tabs. */
  tabs?: Record<string, Tab>;
}

interface SaveBeforeCloseResult {
  ok: boolean;
  message?: string;
}

const AUTO_SAVE_DELAY_MS = 1000;
let evaluatedTabCount = 0;
let evaluatedSaveStatusTabCount = 0;

/** @internal Test-only counter for changed-tab scheduling assertions. */
export function __getAutoSaveEvaluatedTabCountForTests(): number {
  return evaluatedTabCount;
}

/** @internal Test-only reset for changed-tab scheduling assertions. */
export function __resetAutoSaveEvaluatedTabCountForTests(): void {
  evaluatedTabCount = 0;
  evaluatedSaveStatusTabCount = 0;
}

/** @internal Test-only counter for incremental save-status assertions. */
export function __getAutoSaveStatusEvaluatedTabCountForTests(): number {
  return evaluatedSaveStatusTabCount;
}

export function useEditorAutoSave({
  conflictCloseBlockedMessage,
  onSaved,
  onSaveError,
  saveFailedMessage
}: UseEditorAutoSaveInput): {
  flushTabsBeforeClose: (tabIds: string[]) => Promise<SaveBeforeCloseResult>;
  saveStatusByTabId: Record<string, EditorSaveStatus>;
} {
  const [queueSnapshot, setQueueSnapshot] = useState(0);
  const dirtyStatusTabIdsRef = useRef<Set<string>>(new Set());
  const queuesRef = useRef<Map<string, SaveQueue> | null>(null);
  const statusByTabIdRef = useRef<Map<string, EditorSaveStatus> | null>(null);
  const onSavedRef = useLatest(onSaved);
  const onSaveErrorRef = useLatest(onSaveError);

  if (queuesRef.current === null) {
    queuesRef.current = new Map();
  }

  const queues = queuesRef.current;
  if (statusByTabIdRef.current === null) {
    statusByTabIdRef.current = initialEditorSaveStatuses(useEditorStore.getState().tabs);
  }
  const statusByTabId = statusByTabIdRef.current;

  const notifyQueueChanged = useCallback((tabId?: string | null): void => {
    if (tabId) dirtyStatusTabIdsRef.current.add(tabId);
    setQueueSnapshot((value) => value + 1);
  }, []);

  const queueForPath = useCallback((path: string): SaveQueue => {
    const existing = queues.get(path);
    if (existing) return existing;

    const queue: SaveQueue = {
      lastError: null,
      pending: null,
      saving: false,
      tabId: null,
      timer: null,
      waiters: []
    };
    queues.set(path, queue);
    return queue;
  }, [queues]);

  const wakeWaiters = useCallback((queue: SaveQueue): void => {
    if (queue.saving || queue.pending || queue.timer) return;

    const waiters = queue.waiters.splice(0);
    for (const waiter of waiters) waiter();
  }, []);

  const runQueue = useCallback((path: string): void => {
    const queue = queueForPath(path);
    if (queue.saving) return;

    const request = queue.pending;
    if (!request || !relicClient.current) {
      wakeWaiters(queue);
      return;
    }

    queue.pending = null;
    queue.saving = true;
    queue.lastError = null;
    notifyQueueChanged(request.tabId);
    let saveSucceeded = false;

    void relicClient.current.writeMarkdownFile({
      content: request.content,
      expectedContent: request.expectedContent,
      path: request.path
    })
      .then((result) => {
        if (!result.ok) {
          queue.lastError = result.error.message;
          onSaveErrorRef.current?.(result.error.message);
          return;
        }

        saveSucceeded = true;

        const currentTab = useEditorStore.getState().tabs[request.tabId];
        if (
          currentTab?.kind === "file" &&
          !currentTab.externalConflict &&
          currentTab.path === request.path
        ) {
          useEditorStore.getState().markTabSavedCheckpoint(request.tabId, request.content);
          if (queue.pending?.tabId === request.tabId && queue.pending.path === request.path) {
            queue.pending = { ...queue.pending, expectedContent: request.content };
          }
          onSavedRef.current?.(request.path);
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        queue.lastError = message;
        onSaveErrorRef.current?.(message);
      })
      .finally(() => {
        queue.saving = false;
        notifyQueueChanged(request.tabId);

        if (queue.pending && saveSucceeded) {
          runQueue(path);
          return;
        }

        if (!saveSucceeded) queue.pending = null;

        wakeWaiters(queue);
      });
  }, [notifyQueueChanged, queueForPath, wakeWaiters]);

  const scheduleSave = useCallback((request: SaveRequest, delay: number): void => {
    if (!relicClient.current) return;

    const queue = queueForPath(request.path);
    queue.tabId = request.tabId;
    queue.pending = request;
    queue.lastError = null;

    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }

    if (queue.saving) {
      notifyQueueChanged(request.tabId);
      return;
    }

    if (delay <= 0) {
      runQueue(request.path);
      return;
    }

    queue.timer = setTimeout(() => {
      queue.timer = null;
      runQueue(request.path);
    }, delay);
    notifyQueueChanged(request.tabId);
  }, [notifyQueueChanged, queueForPath, runQueue]);

  const waitForIdle = useCallback((path: string): Promise<void> => {
    const queue = queueForPath(path);
    if (!queue.saving && !queue.pending && !queue.timer) return Promise.resolve();

    return new Promise((resolve) => {
      queue.waiters.push(resolve);
    });
  }, [queueForPath]);

  const evaluateTab = useCallback((tabId: string): void => {
    evaluatedTabCount += 1;
    dirtyStatusTabIdsRef.current.add(tabId);
    const tab = useEditorStore.getState().tabs[tabId];
    if (tab?.kind !== "file") return;
    for (const [path, existingQueue] of queues.entries()) {
      if (existingQueue.tabId !== tabId || path === tab.path) continue;
      if (existingQueue.timer) clearTimeout(existingQueue.timer);
      queues.delete(path);
    }
      const queue = queues.get(tab.path);

      if (tab.externalConflict || tab.content === tab.savedContent) {
        if (queue?.timer) {
          clearTimeout(queue.timer);
          queue.timer = null;
        }
        if (queue?.pending) queue.pending = null;
        if (queue) {
          wakeWaiters(queue);
        }
        notifyQueueChanged(tabId);
        return;
      }

      if (queue?.pending?.tabId === tab.id && queue.pending.content === tab.content) return;

      scheduleSave({ content: tab.content, expectedContent: tab.savedContent, path: tab.path, tabId: tab.id }, AUTO_SAVE_DELAY_MS);
  }, [notifyQueueChanged, queues, scheduleSave, wakeWaiters]);

  useEffect(() => {
    for (const tab of Object.values(useEditorStore.getState().tabs)) {
      if (tab.kind === "file") evaluateTab(tab.id);
    }

    const unsubscribeChanges = subscribeEditorTabChanges(evaluateTab);
    const unsubscribeStructure = useEditorStore.subscribe((state, previous) => {
      if (state.leftPane === previous.leftPane && state.rightPane === previous.rightPane) return;
      for (const [path, queue] of queues.entries()) {
        const tab = queue.tabId ? state.tabs[queue.tabId] : undefined;
        if (tab?.kind === "file" && tab.path === path) continue;
        if (queue.timer) clearTimeout(queue.timer);
        queues.delete(path);
      }
      for (const tabId of statusByTabId.keys()) dirtyStatusTabIdsRef.current.add(tabId);
      for (const tab of Object.values(state.tabs)) {
        if (tab.kind === "file") dirtyStatusTabIdsRef.current.add(tab.id);
      }
      notifyQueueChanged();
    });

    return () => {
      unsubscribeChanges();
      unsubscribeStructure();
    };
  }, [evaluateTab, notifyQueueChanged, queues, statusByTabId]);

  useEffect(() => {
    return () => {
      for (const queue of queues.values()) {
        if (queue.timer) clearTimeout(queue.timer);
      }
      queues.clear();
    };
  }, [queues]);

  const flushTabsBeforeClose = useCallback(async (tabIds: string[]): Promise<SaveBeforeCloseResult> => {
    flushPendingEditorChanges(tabIds);
    const state = useEditorStore.getState();
    const targets = Array.from(new Set(tabIds))
      .map((tabId) => state.tabs[tabId])
      .filter((tab): tab is FileTab => tab?.kind === "file");

    const conflicted = targets.find((tab) => tab.externalConflict);
    if (conflicted) {
      return { ok: false, message: conflictCloseBlockedMessage };
    }

    const dirtyTargets = targets.filter((tab) => tab.content !== tab.savedContent);

    for (const tab of dirtyTargets) {
      scheduleSave({ content: tab.content, expectedContent: tab.savedContent, path: tab.path, tabId: tab.id }, 0);
    }

    await Promise.all(dirtyTargets.map((tab) => waitForIdle(tab.path)));

    const latestState = useEditorStore.getState();
    const unsaved = dirtyTargets.find((tab) => {
      const latest = latestState.tabs[tab.id];
      return latest?.kind === "file" && latest.content !== latest.savedContent;
    });

    if (unsaved) {
      const queue = queues.get(unsaved.path);
      return { ok: false, message: queue?.lastError ?? saveFailedMessage };
    }

    return { ok: true };
  }, [conflictCloseBlockedMessage, queues, saveFailedMessage, scheduleSave, waitForIdle]);

  const saveStatusByTabId = useMemo(() => {
    void queueSnapshot;
    const tabs = useEditorStore.getState().tabs;
    evaluatedSaveStatusTabCount += updateEditorSaveStatuses(
      statusByTabId,
      dirtyStatusTabIdsRef.current,
      tabs,
      (path) => queues.get(path)
    );
    dirtyStatusTabIdsRef.current.clear();
    return Object.fromEntries(statusByTabId);
  }, [queueSnapshot, queues, statusByTabId]);

  return {
    flushTabsBeforeClose,
    saveStatusByTabId
  };
}
