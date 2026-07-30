import type { AppSettings } from "../settings/appSettings";
import { workspaceWatchEventChangedPaths } from "../files/workspaceDataInvalidation";
import {
  notifyWorkspaceChanged,
  notifyWorkspaceWatcherStatus
} from "./workspaceWatcherNotifications";
import { WorkspaceWatcherRuntime } from "./workspaceWatcherRuntime";

export {
  activeWorkspaceWatchTarget,
  shouldNotifyWorkspaceChangeEvent,
  workspaceChangeMaxNotifyDelayMs,
  workspaceChangeNotificationDelay,
  workspaceChangeNotifyDelayMs,
  workspaceWatcherFailureNotifyDelayMs,
  workspaceWatcherRetryBaseDelayMs,
  workspaceWatcherRetryDelay,
  workspaceWatcherRetryMaxDelayMs
} from "./workspaceWatcherRuntime";
export {
  notifyWorkspaceChanged,
  notifyWorkspaceWatcherStatus
} from "./workspaceWatcherNotifications";

const defaultWorkspaceWatcherRuntime = new WorkspaceWatcherRuntime({
  notifyWorkspaceChanged,
  notifyWorkspaceWatcherStatus
});

export function syncWorkspaceWatcher(settings: AppSettings): void {
  defaultWorkspaceWatcherRuntime.sync(settings);
}

export function stopWorkspaceWatcher(): void {
  defaultWorkspaceWatcherRuntime.stop();
}

export function workspaceChangeInvalidationPaths(
  eventType: string,
  filename?: string | null
): string[] | undefined {
  return workspaceWatchEventChangedPaths({ eventType, filename });
}
