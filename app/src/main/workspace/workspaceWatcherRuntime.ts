import { watch, type FSWatcher } from "node:fs";

import { isAtomicWriteTemporaryPath } from "../files/atomicWrite";
import type { WorkspaceWatchEvent } from "../files/workspaceDataInvalidation";
import type { AppSettings } from "../settings/appSettings";

export interface WorkspaceWatchTarget {
  id: string;
  path: string;
}

export type WorkspaceWatchListener = (
  eventType: string,
  filename?: string | null
) => void;

export type WorkspaceWatch = (
  targetPath: string,
  options: { recursive: true },
  listener: WorkspaceWatchListener
) => FSWatcher;

export interface WorkspaceWatcherRuntimeNotifications {
  notifyWorkspaceChanged: (
    target: WorkspaceWatchTarget,
    events?: WorkspaceWatchEvent[]
  ) => void;
  notifyWorkspaceWatcherStatus: (target: WorkspaceWatchTarget) => void;
}

interface WorkspaceWatcherRuntimeOptions extends WorkspaceWatcherRuntimeNotifications {
  watchWorkspace?: WorkspaceWatch;
}

export const workspaceChangeNotifyDelayMs = 500;
export const workspaceChangeMaxNotifyDelayMs = 2000;
export const workspaceWatcherRetryBaseDelayMs = 1000;
export const workspaceWatcherRetryMaxDelayMs = 30_000;
export const workspaceWatcherFailureNotifyDelayMs = 5000;

const defaultWatchWorkspace: WorkspaceWatch = (targetPath, options, listener) =>
  watch(targetPath, options, listener);

export class WorkspaceWatcherRuntime {
  private workspaceWatcher: FSWatcher | null = null;
  private desiredTarget: WorkspaceWatchTarget | null = null;
  private notifyTimer: NodeJS.Timeout | null = null;
  private firstPendingNotifyAt: number | null = null;
  private pendingWatchEvents: WorkspaceWatchEvent[] = [];
  private retryTimer: NodeJS.Timeout | null = null;
  private failureNotifyTimer: NodeJS.Timeout | null = null;
  private retryAttempt = 0;
  private watcherUnavailable = false;
  private watcherUnavailableNotified = false;
  private readonly watchWorkspace: WorkspaceWatch;
  private readonly notifications: WorkspaceWatcherRuntimeNotifications;

  constructor(options: WorkspaceWatcherRuntimeOptions) {
    this.watchWorkspace = options.watchWorkspace ?? defaultWatchWorkspace;
    this.notifications = {
      notifyWorkspaceChanged: options.notifyWorkspaceChanged,
      notifyWorkspaceWatcherStatus: options.notifyWorkspaceWatcherStatus
    };
  }

  sync(settings: AppSettings): void {
    const target = activeWorkspaceWatchTarget(settings);

    if (!target) {
      this.stop();
      return;
    }

    if (sameWorkspaceWatchTarget(this.desiredTarget, target)) {
      if (this.workspaceWatcher || this.retryTimer) return;
      this.start(target);
      return;
    }

    this.stop();
    this.desiredTarget = target;
    this.start(target);
  }

  stop(): void {
    this.desiredTarget = null;
    this.clearRetry();
    this.clearFailureState();
    this.retryAttempt = 0;
    this.closeActiveWatcher();
  }

  private start(target: WorkspaceWatchTarget): void {
    if (!sameWorkspaceWatchTarget(this.desiredTarget, target)) return;
    this.clearRetry();

    try {
      let watcher: FSWatcher | null = null;
      watcher = this.watchWorkspace(target.path, { recursive: true }, (eventType, filename) => {
        if (this.workspaceWatcher !== watcher || !sameWorkspaceWatchTarget(this.desiredTarget, target)) {
          return;
        }
        if (!shouldNotifyWorkspaceChangeEvent(eventType, filename)) return;
        this.scheduleChangedNotification(target, eventType, filename);
      });
      this.workspaceWatcher = watcher;
      watcher.on("error", () => this.handleFailure(target, watcher));

      if (this.watcherUnavailable) {
        this.clearFailureState();
        this.notifications.notifyWorkspaceChanged(target);
      }
      this.retryAttempt = 0;
    } catch {
      this.handleFailure(target);
    }
  }

  private handleFailure(target: WorkspaceWatchTarget, watcher?: FSWatcher): void {
    if (!sameWorkspaceWatchTarget(this.desiredTarget, target)) return;
    if (watcher && this.workspaceWatcher !== watcher) return;

    this.closeActiveWatcher();
    this.watcherUnavailable = true;
    this.scheduleFailureNotification(target);
    this.scheduleRetry(target);
  }

  private scheduleRetry(target: WorkspaceWatchTarget): void {
    this.clearRetry();
    const delay = workspaceWatcherRetryDelay(this.retryAttempt);
    this.retryAttempt = Math.min(this.retryAttempt + 1, 5);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.start(target);
    }, delay);
  }

  private scheduleFailureNotification(target: WorkspaceWatchTarget): void {
    if (this.failureNotifyTimer || this.watcherUnavailableNotified) return;

    this.failureNotifyTimer = setTimeout(() => {
      this.failureNotifyTimer = null;
      if (!this.watcherUnavailable || !sameWorkspaceWatchTarget(this.desiredTarget, target)) {
        return;
      }
      this.watcherUnavailableNotified = true;
      this.notifications.notifyWorkspaceWatcherStatus(target);
    }, workspaceWatcherFailureNotifyDelayMs);
  }

  private closeActiveWatcher(): void {
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer);
      this.notifyTimer = null;
    }
    this.firstPendingNotifyAt = null;
    this.pendingWatchEvents = [];

    this.workspaceWatcher?.close();
    this.workspaceWatcher = null;
  }

  private clearRetry(): void {
    if (!this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private clearFailureState(): void {
    if (this.failureNotifyTimer) {
      clearTimeout(this.failureNotifyTimer);
      this.failureNotifyTimer = null;
    }
    this.watcherUnavailable = false;
    this.watcherUnavailableNotified = false;
  }

  private scheduleChangedNotification(
    target: WorkspaceWatchTarget,
    eventType: string,
    filename?: string | null
  ): void {
    this.pendingWatchEvents.push({ eventType, filename });

    const now = Date.now();
    this.firstPendingNotifyAt ??= now;

    if (this.notifyTimer) clearTimeout(this.notifyTimer);

    const delay = workspaceChangeNotificationDelay(this.firstPendingNotifyAt, now);

    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.firstPendingNotifyAt = null;
      const events = this.pendingWatchEvents;
      this.pendingWatchEvents = [];
      this.notifications.notifyWorkspaceChanged(target, events);
    }, delay);
  }
}

export function activeWorkspaceWatchTarget(settings: AppSettings): WorkspaceWatchTarget | null {
  if (!settings.lastWorkspaceId) return null;

  const workspace = settings.workspaces.find((candidate) => candidate.id === settings.lastWorkspaceId);
  if (!workspace) return null;

  return { id: workspace.id, path: workspace.path };
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

export function workspaceChangeNotificationDelay(firstEventAt: number, now: number): number {
  const elapsed = now - firstEventAt;

  if (elapsed >= workspaceChangeMaxNotifyDelayMs) return 0;

  return Math.min(workspaceChangeNotifyDelayMs, workspaceChangeMaxNotifyDelayMs - elapsed);
}

function sameWorkspaceWatchTarget(
  first: WorkspaceWatchTarget | null,
  second: WorkspaceWatchTarget | null
): boolean {
  return first?.id === second?.id && first?.path === second?.path;
}
