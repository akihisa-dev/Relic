import { watch, type FSWatcher } from "node:fs";

import { BrowserWindow } from "electron";

import {
  workspaceChangedChannel,
  workspaceWatcherStatusChannel,
  type WorkspaceChangedEvent,
  type WorkspaceWatcherStatusEvent
} from "../../shared/ipc";
import type { AppSettings } from "../settings/appSettings";
import { isAtomicWriteTemporaryPath } from "../files/atomicWrite";
import {
  workspaceMutationCoordinator,
  workspaceWatchEventChangedPaths,
  type WorkspaceWatchEvent
} from "../files/workspaceDataInvalidation";

interface WorkspaceWatchTarget {
  id: string;
  path: string;
}

let workspaceWatcher: FSWatcher | null = null;
let desiredTarget: WorkspaceWatchTarget | null = null;
let notifyTimer: NodeJS.Timeout | null = null;
let firstPendingNotifyAt: number | null = null;
let pendingWatchEvents: WorkspaceWatchEvent[] = [];
let retryTimer: NodeJS.Timeout | null = null;
let failureNotifyTimer: NodeJS.Timeout | null = null;
let retryAttempt = 0;
let watcherUnavailable = false;
let watcherUnavailableNotified = false;

export const workspaceChangeNotifyDelayMs = 500;
export const workspaceChangeMaxNotifyDelayMs = 2000;
export const workspaceWatcherRetryBaseDelayMs = 1000;
export const workspaceWatcherRetryMaxDelayMs = 30_000;
export const workspaceWatcherFailureNotifyDelayMs = 5000;

export function activeWorkspaceWatchTarget(settings: AppSettings): WorkspaceWatchTarget | null {
  if (!settings.lastWorkspaceId) return null;

  const workspace = settings.workspaces.find((candidate) => candidate.id === settings.lastWorkspaceId);
  if (!workspace) return null;

  return { id: workspace.id, path: workspace.path };
}

export function syncWorkspaceWatcher(settings: AppSettings): void {
  const target = activeWorkspaceWatchTarget(settings);

  if (!target) {
    stopWorkspaceWatcher();
    return;
  }

  if (sameWorkspaceWatchTarget(desiredTarget, target)) {
    if (workspaceWatcher || retryTimer) return;
    startWorkspaceWatcher(target);
    return;
  }

  stopWorkspaceWatcher();
  desiredTarget = target;
  startWorkspaceWatcher(target);
}

function startWorkspaceWatcher(target: WorkspaceWatchTarget): void {
  if (!sameWorkspaceWatchTarget(desiredTarget, target)) return;
  clearWorkspaceWatcherRetry();

  try {
    let watcher: FSWatcher | null = null;
    watcher = watch(target.path, { recursive: true }, (eventType, filename) => {
      if (workspaceWatcher !== watcher || !sameWorkspaceWatchTarget(desiredTarget, target)) return;
      if (!shouldNotifyWorkspaceChangeEvent(eventType, filename)) return;
      scheduleWorkspaceChangedNotification(target, eventType, filename);
    });
    workspaceWatcher = watcher;
    watcher.on("error", () => handleWorkspaceWatcherFailure(target, watcher));

    if (watcherUnavailable) {
      clearWorkspaceWatcherFailureState();
      notifyWorkspaceChanged(target);
    }
    retryAttempt = 0;
  } catch {
    handleWorkspaceWatcherFailure(target);
  }
}

function handleWorkspaceWatcherFailure(target: WorkspaceWatchTarget, watcher?: FSWatcher): void {
  if (!sameWorkspaceWatchTarget(desiredTarget, target)) return;
  if (watcher && workspaceWatcher !== watcher) return;

  closeActiveWorkspaceWatcher();
  watcherUnavailable = true;
  scheduleWorkspaceWatcherFailureNotification(target);
  scheduleWorkspaceWatcherRetry(target);
}

function scheduleWorkspaceWatcherRetry(target: WorkspaceWatchTarget): void {
  clearWorkspaceWatcherRetry();
  const delay = workspaceWatcherRetryDelay(retryAttempt);
  retryAttempt = Math.min(retryAttempt + 1, 5);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startWorkspaceWatcher(target);
  }, delay);
}

function scheduleWorkspaceWatcherFailureNotification(target: WorkspaceWatchTarget): void {
  if (failureNotifyTimer || watcherUnavailableNotified) return;

  failureNotifyTimer = setTimeout(() => {
    failureNotifyTimer = null;
    if (!watcherUnavailable || !sameWorkspaceWatchTarget(desiredTarget, target)) return;
    watcherUnavailableNotified = true;
    notifyWorkspaceWatcherStatus(target);
  }, workspaceWatcherFailureNotifyDelayMs);
}

export function workspaceWatcherRetryDelay(attempt: number): number {
  return Math.min(workspaceWatcherRetryBaseDelayMs * (2 ** attempt), workspaceWatcherRetryMaxDelayMs);
}

export function shouldNotifyWorkspaceChangeEvent(
  eventType: string,
  filename?: string | null
): boolean {
  if (eventType !== "rename" && eventType !== "change") return false;
  return filename ? !isAtomicWriteTemporaryPath(filename) : true;
}

export function stopWorkspaceWatcher(): void {
  desiredTarget = null;
  clearWorkspaceWatcherRetry();
  clearWorkspaceWatcherFailureState();
  retryAttempt = 0;
  closeActiveWorkspaceWatcher();
}

function closeActiveWorkspaceWatcher(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
  }
  firstPendingNotifyAt = null;
  pendingWatchEvents = [];

  workspaceWatcher?.close();
  workspaceWatcher = null;
}

function clearWorkspaceWatcherRetry(): void {
  if (!retryTimer) return;
  clearTimeout(retryTimer);
  retryTimer = null;
}

function clearWorkspaceWatcherFailureState(): void {
  if (failureNotifyTimer) {
    clearTimeout(failureNotifyTimer);
    failureNotifyTimer = null;
  }
  watcherUnavailable = false;
  watcherUnavailableNotified = false;
}

function sameWorkspaceWatchTarget(
  first: WorkspaceWatchTarget | null,
  second: WorkspaceWatchTarget | null
): boolean {
  return first?.id === second?.id && first?.path === second?.path;
}

function scheduleWorkspaceChangedNotification(
  target: WorkspaceWatchTarget,
  eventType: string,
  filename?: string | null
): void {
  pendingWatchEvents.push({ eventType, filename });

  const now = Date.now();
  firstPendingNotifyAt ??= now;

  if (notifyTimer) clearTimeout(notifyTimer);

  const delay = workspaceChangeNotificationDelay(firstPendingNotifyAt, now);

  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    firstPendingNotifyAt = null;
    const events = pendingWatchEvents;
    pendingWatchEvents = [];
    notifyWorkspaceChanged(target, events);
  }, delay);
}

export function workspaceChangeInvalidationPaths(
  eventType: string,
  filename?: string | null
): string[] | undefined {
  return workspaceWatchEventChangedPaths({ eventType, filename });
}

export function workspaceChangeNotificationDelay(firstEventAt: number, now: number): number {
  const elapsed = now - firstEventAt;

  if (elapsed >= workspaceChangeMaxNotifyDelayMs) return 0;

  return Math.min(workspaceChangeNotifyDelayMs, workspaceChangeMaxNotifyDelayMs - elapsed);
}

export function notifyWorkspaceChanged(target: WorkspaceWatchTarget, events: WorkspaceWatchEvent[] = []): void {
  workspaceMutationCoordinator.invalidateWatcherEvents(target.id, events);

  const payload: WorkspaceChangedEvent = {
    changedAt: new Date().toISOString(),
    workspaceId: target.id
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(workspaceChangedChannel, payload);
    }
  }
}

export function notifyWorkspaceWatcherStatus(target: WorkspaceWatchTarget): void {
  const payload: WorkspaceWatcherStatusEvent = {
    changedAt: new Date().toISOString(),
    status: "unavailable",
    workspaceId: target.id
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(workspaceWatcherStatusChannel, payload);
    }
  }
}
