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
  const invalidation = workspaceMutationCoordinator.invalidateWatcherEvents(target.id, events);
  if (invalidation.kind === "none") return;

  const payload: WorkspaceChangedEvent = invalidation.kind === "paths"
    ? {
      changedAt: new Date().toISOString(),
      kind: "paths",
      paths: invalidation.paths,
      revision: nextWorkspaceChangedRevision(),
      workspaceId: target.id
    }
    : {
      changedAt: new Date().toISOString(),
      kind: "full",
      revision: nextWorkspaceChangedRevision(),
      workspaceId: target.id
    };

  sendToActiveWindows(workspaceChangedChannel, payload);
}

let workspaceChangedRevision = 0;

function nextWorkspaceChangedRevision(): number {
  workspaceChangedRevision += 1;
  return workspaceChangedRevision;
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
