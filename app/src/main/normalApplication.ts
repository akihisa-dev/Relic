import type { BrowserWindow } from "electron";

import { configureApplicationMenu } from "./applicationMenu";
import { registerAppHandlers } from "./ipc/appHandlers";
import { registerEditorHandlers } from "./ipc/editorHandlers";
import { registerFileHandlers } from "./ipc/fileHandlers";
import { configureIpcSenderAuthorization } from "./ipc/ipcSenderAuthorization";
import { registerOutputHandlers } from "./ipc/outputHandlers";
import { registerToolHandlers } from "./ipc/toolHandlers";
import { registerWorkspaceHandlers } from "./ipc/workspaceHandlers";

interface NormalApplicationDependencies {
  configureApplicationMenu: typeof configureApplicationMenu;
  configureIpcSenderAuthorization: typeof configureIpcSenderAuthorization;
  registerHandlers: Array<() => void>;
}

const defaultDependencies: NormalApplicationDependencies = {
  configureApplicationMenu,
  configureIpcSenderAuthorization,
  registerHandlers: [
    registerAppHandlers,
    registerEditorHandlers,
    registerFileHandlers,
    registerOutputHandlers,
    registerToolHandlers,
    registerWorkspaceHandlers
  ]
};

export function createNormalApplicationInitializer(
  getMainWindow: () => BrowserWindow | null,
  dependencies: NormalApplicationDependencies = defaultDependencies
): () => void {
  let initialized = false;

  return () => {
    if (initialized) return;

    dependencies.configureIpcSenderAuthorization((sender) => isCurrentMainWindowSender(
      getMainWindow(),
      sender
    ));
    dependencies.registerHandlers.forEach((register) => register());
    dependencies.configureApplicationMenu(getMainWindow);
    initialized = true;
  };
}

export function isCurrentMainWindowSender(
  mainWindow: BrowserWindow | null,
  sender: unknown
): boolean {
  return Boolean(
    mainWindow
    && !mainWindow.isDestroyed()
    && !mainWindow.webContents.isDestroyed()
    && sender === mainWindow.webContents
  );
}
