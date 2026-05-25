import { watch, type FSWatcher } from "node:fs";

import { BrowserWindow } from "electron";

import { workspaceChangedChannel, type WorkspaceChangedEvent } from "../../shared/ipc";
import type { AppSettings } from "../settings/appSettings";

interface WorkspaceWatchTarget {
  id: string;
  path: string;
}

let workspaceWatcher: FSWatcher | null = null;
let watchedTarget: WorkspaceWatchTarget | null = null;
let notifyTimer: NodeJS.Timeout | null = null;
let firstPendingNotifyAt: number | null = null;

export const workspaceChangeNotifyDelayMs = 500;
export const workspaceChangeMaxNotifyDelayMs = 2000;

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

  if (watchedTarget?.id === target.id && watchedTarget.path === target.path) return;

  stopWorkspaceWatcher();

  try {
    workspaceWatcher = watch(target.path, { recursive: true }, (eventType) => {
      if (!shouldNotifyWorkspaceChangeEvent(eventType)) return;
      scheduleWorkspaceChangedNotification(target);
    });
    workspaceWatcher.on("error", () => stopWorkspaceWatcher());
    watchedTarget = target;
  } catch {
    stopWorkspaceWatcher();
  }
}

export function shouldNotifyWorkspaceChangeEvent(eventType: string): boolean {
  return eventType === "rename" || eventType === "change";
}

export function stopWorkspaceWatcher(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
  }
  firstPendingNotifyAt = null;

  workspaceWatcher?.close();
  workspaceWatcher = null;
  watchedTarget = null;
}

function scheduleWorkspaceChangedNotification(target: WorkspaceWatchTarget): void {
  const now = Date.now();
  firstPendingNotifyAt ??= now;

  if (notifyTimer) clearTimeout(notifyTimer);

  const delay = workspaceChangeNotificationDelay(firstPendingNotifyAt, now);

  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    firstPendingNotifyAt = null;
    notifyWorkspaceChanged(target);
  }, delay);
}

export function workspaceChangeNotificationDelay(firstEventAt: number, now: number): number {
  const elapsed = now - firstEventAt;

  if (elapsed >= workspaceChangeMaxNotifyDelayMs) return 0;

  return Math.min(workspaceChangeNotifyDelayMs, workspaceChangeMaxNotifyDelayMs - elapsed);
}

function notifyWorkspaceChanged(target: WorkspaceWatchTarget): void {
  const payload: WorkspaceChangedEvent = {
    changedAt: new Date().toISOString(),
    workspaceId: target.id,
    workspacePath: target.path
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(workspaceChangedChannel, payload);
    }
  }
}
