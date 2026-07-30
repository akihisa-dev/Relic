import { BrowserWindow } from "electron";

import {
  workspaceChangedChannel,
  workspaceWatcherStatusChannel,
  type WorkspaceChangedEvent,
  type WorkspaceWatcherStatusEvent
} from "../../shared/ipc";
import {
  workspaceMutationCoordinator,
  type WorkspaceWatchEvent
} from "../files/workspaceDataInvalidation";
import type { WorkspaceWatchTarget } from "./workspaceWatcherRuntime";

export function notifyWorkspaceChanged(
  target: WorkspaceWatchTarget,
  events: WorkspaceWatchEvent[] = []
): void {
  workspaceMutationCoordinator.invalidateWatcherEvents(target.id, events);

  const payload: WorkspaceChangedEvent = {
    changedAt: new Date().toISOString(),
    workspaceId: target.id
  };

  sendToActiveWindows(workspaceChangedChannel, payload);
}

export function notifyWorkspaceWatcherStatus(target: WorkspaceWatchTarget): void {
  const payload: WorkspaceWatcherStatusEvent = {
    changedAt: new Date().toISOString(),
    status: "unavailable",
    workspaceId: target.id
  };

  sendToActiveWindows(workspaceWatcherStatusChannel, payload);
}

function sendToActiveWindows(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, payload);
    }
  }
}
