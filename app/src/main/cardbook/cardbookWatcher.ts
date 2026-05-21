import { watch, type FSWatcher } from "node:fs";

import { BrowserWindow } from "electron";

import { cardbookChangedChannel, type CardbookChangedEvent } from "../../shared/ipc";
import type { AppSettings } from "../settings/appSettings";

interface CardbookWatchTarget {
  id: string;
  path: string;
}

let cardbookWatcher: FSWatcher | null = null;
let watchedTarget: CardbookWatchTarget | null = null;
let notifyTimer: NodeJS.Timeout | null = null;

export function activeCardbookWatchTarget(settings: AppSettings): CardbookWatchTarget | null {
  if (!settings.lastCardbookId) return null;

  const cardbook = settings.cardbooks.find((candidate) => candidate.id === settings.lastCardbookId);
  if (!cardbook) return null;

  return { id: cardbook.id, path: cardbook.path };
}

export function syncCardbookWatcher(settings: AppSettings): void {
  const target = activeCardbookWatchTarget(settings);

  if (!target) {
    stopCardbookWatcher();
    return;
  }

  if (watchedTarget?.id === target.id && watchedTarget.path === target.path) return;

  stopCardbookWatcher();

  try {
    cardbookWatcher = watch(target.path, { recursive: true }, (eventType) => {
      if (eventType !== "rename") return;
      scheduleCardbookChangedNotification(target);
    });
    cardbookWatcher.on("error", () => stopCardbookWatcher());
    watchedTarget = target;
  } catch {
    stopCardbookWatcher();
  }
}

export function stopCardbookWatcher(): void {
  if (notifyTimer) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
  }

  cardbookWatcher?.close();
  cardbookWatcher = null;
  watchedTarget = null;
}

function scheduleCardbookChangedNotification(target: CardbookWatchTarget): void {
  if (notifyTimer) clearTimeout(notifyTimer);

  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    notifyCardbookChanged(target);
  }, 200);
}

function notifyCardbookChanged(target: CardbookWatchTarget): void {
  const payload: CardbookChangedEvent = {
    changedAt: new Date().toISOString(),
    cardbookId: target.id,
    cardbookPath: target.path
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(cardbookChangedChannel, payload);
    }
  }
}
