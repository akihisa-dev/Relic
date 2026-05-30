import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FileTab, Tab } from "../store/editorStore";
import { useEditorStore } from "../store/editorStore";

export type EditorSaveStatus = "saved" | "dirty" | "saving" | "error" | "externalConflict";

interface SaveRequest {
  content: string;
  path: string;
  tabId: string;
}

interface SaveQueue {
  lastError: string | null;
  pending: SaveRequest | null;
  saving: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  waiters: Array<() => void>;
}

interface UseEditorAutoSaveInput {
  conflictCloseBlockedMessage: string;
  onSaved?: (path: string) => void;
  onSaveError?: (message: string) => void;
  tabs: Record<string, Tab>;
}

interface SaveBeforeCloseResult {
  ok: boolean;
  message?: string;
}

const AUTO_SAVE_DELAY_MS = 1000;

export function useEditorAutoSave({
  conflictCloseBlockedMessage,
  onSaved,
  onSaveError,
  tabs
}: UseEditorAutoSaveInput): {
  flushTabsBeforeClose: (tabIds: string[]) => Promise<SaveBeforeCloseResult>;
  saveStatusByTabId: Record<string, EditorSaveStatus>;
} {
  const [queueSnapshot, setQueueSnapshot] = useState(0);
  const queuesRef = useRef<Map<string, SaveQueue> | null>(null);
  const onSavedRef = useRef(onSaved);
  const onSaveErrorRef = useRef(onSaveError);

  if (queuesRef.current === null) {
    queuesRef.current = new Map();
  }

  const queues = queuesRef.current;

  onSavedRef.current = onSaved;
  onSaveErrorRef.current = onSaveError;

  const notifyQueueChanged = useCallback((): void => {
    setQueueSnapshot((value) => value + 1);
  }, []);

  const queueForPath = useCallback((path: string): SaveQueue => {
    const existing = queues.get(path);
    if (existing) return existing;

    const queue: SaveQueue = {
      lastError: null,
      pending: null,
      saving: false,
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
    if (!request || !window.relic) {
      wakeWaiters(queue);
      return;
    }

    queue.pending = null;
    queue.saving = true;
    queue.lastError = null;
    notifyQueueChanged();

    void window.relic.writeMarkdownFile({ content: request.content, path: request.path })
      .then((result) => {
        if (!result.ok) {
          queue.lastError = result.error.message;
          onSaveErrorRef.current?.(result.error.message);
          return;
        }

        const currentTab = useEditorStore.getState().tabs[request.tabId];
        if (
          currentTab?.kind === "file" &&
          !currentTab.externalConflict &&
          currentTab.path === request.path &&
          currentTab.content === request.content
        ) {
          useEditorStore.getState().markTabSaved(request.tabId, request.content);
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
        notifyQueueChanged();

        if (queue.pending) {
          runQueue(path);
          return;
        }

        wakeWaiters(queue);
      });
  }, [notifyQueueChanged, queueForPath, wakeWaiters]);

  const scheduleSave = useCallback((request: SaveRequest, delay: number): void => {
    if (!window.relic) return;

    const queue = queueForPath(request.path);
    queue.pending = request;
    queue.lastError = null;

    if (queue.timer) {
      clearTimeout(queue.timer);
      queue.timer = null;
    }

    if (queue.saving) {
      notifyQueueChanged();
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
    notifyQueueChanged();
  }, [notifyQueueChanged, queueForPath, runQueue]);

  const waitForIdle = useCallback((path: string): Promise<void> => {
    const queue = queueForPath(path);
    if (!queue.saving && !queue.pending && !queue.timer) return Promise.resolve();

    return new Promise((resolve) => {
      queue.waiters.push(resolve);
    });
  }, [queueForPath]);

  useEffect(() => {
    const openFileTabs = Object.values(tabs).filter((tab): tab is FileTab => tab.kind === "file");
    const openPaths = new Set(openFileTabs.map((tab) => tab.path));

    for (const [path, queue] of queues.entries()) {
      if (openPaths.has(path)) continue;

      if (queue.timer) clearTimeout(queue.timer);
      queues.delete(path);
    }

    for (const tab of openFileTabs) {
      const queue = queues.get(tab.path);

      if (tab.externalConflict || tab.content === tab.savedContent) {
        if (queue?.timer) {
          clearTimeout(queue.timer);
          queue.timer = null;
        }
        if (queue?.pending) queue.pending = null;
        if (queue) {
          wakeWaiters(queue);
          notifyQueueChanged();
        }
        continue;
      }

      if (queue?.pending?.tabId === tab.id && queue.pending.content === tab.content) continue;

      scheduleSave({ content: tab.content, path: tab.path, tabId: tab.id }, AUTO_SAVE_DELAY_MS);
    }
  }, [notifyQueueChanged, queues, scheduleSave, tabs, wakeWaiters]);

  useEffect(() => {
    return () => {
      for (const queue of queues.values()) {
        if (queue.timer) clearTimeout(queue.timer);
      }
      queues.clear();
    };
  }, [queues]);

  const flushTabsBeforeClose = useCallback(async (tabIds: string[]): Promise<SaveBeforeCloseResult> => {
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
      scheduleSave({ content: tab.content, path: tab.path, tabId: tab.id }, 0);
    }

    await Promise.all(dirtyTargets.map((tab) => waitForIdle(tab.path)));

    const latestState = useEditorStore.getState();
    const unsaved = dirtyTargets.find((tab) => {
      const latest = latestState.tabs[tab.id];
      return latest?.kind === "file" && latest.content !== latest.savedContent;
    });

    if (unsaved) {
      const queue = queues.get(unsaved.path);
      return { ok: false, message: queue?.lastError ?? "ファイルを保存できませんでした。" };
    }

    return { ok: true };
  }, [conflictCloseBlockedMessage, queues, scheduleSave, waitForIdle]);

  const saveStatusByTabId = useMemo(() => {
    void queueSnapshot;

    const entries = Object.values(tabs).flatMap((tab): Array<[string, EditorSaveStatus]> => {
      if (tab.kind !== "file") return [];
      if (tab.externalConflict) return [[tab.id, "externalConflict" satisfies EditorSaveStatus]];

      const queue = queues.get(tab.path);
      if (queue?.saving) return [[tab.id, "saving" satisfies EditorSaveStatus]];
      if (queue?.lastError) return [[tab.id, "error" satisfies EditorSaveStatus]];
      if (tab.content !== tab.savedContent) return [[tab.id, "dirty" satisfies EditorSaveStatus]];

      return [[tab.id, "saved" satisfies EditorSaveStatus]];
    });

    return Object.fromEntries(entries);
  }, [queueSnapshot, queues, tabs]);

  return {
    flushTabsBeforeClose,
    saveStatusByTabId
  };
}
