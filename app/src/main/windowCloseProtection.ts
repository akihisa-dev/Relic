import { BrowserWindow, ipcMain } from "electron";

import { windowCloseRequestedChannel, windowCloseResponseChannel, type WindowCloseResponseInput } from "../shared/ipc";

export const CLOSE_CONFIRM_TIMEOUT_MS = 5000;

const approvedWindowCloseIds = new WeakSet<BrowserWindow>();

export function configureWindowCloseProtection(
  window: BrowserWindow,
  isCloseProtectionBypassed: () => boolean
): void {
  window.on("close", (event) => {
    if (isCloseProtectionBypassed()) return;

    if (approvedWindowCloseIds.has(window)) {
      approvedWindowCloseIds.delete(window);
      return;
    }

    if (window.webContents.isDestroyed()) return;

    event.preventDefault();

    const requestId = `close-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled = false;
    const cleanup = (): void => {
      settled = true;
      clearTimeout(timer);
      ipcMain.removeListener(windowCloseResponseChannel, handleCloseResponse);
    };
    const handleCloseResponse = (_event: Electron.IpcMainEvent, input: WindowCloseResponseInput): void => {
      if (settled || input.requestId !== requestId) return;

      cleanup();

      if (!input.ok || window.isDestroyed()) return;

      approvedWindowCloseIds.add(window);
      window.close();
    };
    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
    }, CLOSE_CONFIRM_TIMEOUT_MS);

    ipcMain.on(windowCloseResponseChannel, handleCloseResponse);
    window.webContents.send(windowCloseRequestedChannel, { requestId });
  });
}
