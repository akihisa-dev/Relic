import { ipcRenderer, type IpcRendererEvent } from "electron";

import {
  createNewWorkspaceChannel,
  getWorkspaceCardsChannel,
  getWorkspaceChartsChannel,
  getWorkspaceChronicleCalendarSettingsChannel,
  getWorkspaceFrontmatterCategoryChoicesChannel,
  getWorkspaceStateChannel,
  getWorkspaceTableChannel,
  openWorkspaceChannel,
  refreshWorkspaceChannel,
  relinkWorkspaceChannel,
  removeWorkspaceChannel,
  renameWorkspaceChannel,
  saveWorkspaceChronicleCalendarSettingsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel,
  saveWorkspaceTablePreferencesChannel,
  switchWorkspaceChannel,
  togglePinChannel,
  workspaceChangedChannel,
  workspaceWatcherStatusChannel,
  sanitizeWorkspaceChangedEvent,
  type WorkspaceApi,
  type WorkspaceWatcherStatusEvent
} from "../../shared/ipc/workspace";

export const workspaceApiFragment: WorkspaceApi = {
  createNewWorkspace: () => ipcRenderer.invoke(createNewWorkspaceChannel),
  togglePin: (path) => ipcRenderer.invoke(togglePinChannel, path),
  getWorkspaceState: () => ipcRenderer.invoke(getWorkspaceStateChannel),
  refreshWorkspace: (input) => ipcRenderer.invoke(refreshWorkspaceChannel, input),
  openWorkspace: () => ipcRenderer.invoke(openWorkspaceChannel),
  relinkWorkspace: (input) => ipcRenderer.invoke(relinkWorkspaceChannel, input),
  removeWorkspace: (input) => ipcRenderer.invoke(removeWorkspaceChannel, input),
  renameWorkspace: (input) => ipcRenderer.invoke(renameWorkspaceChannel, input),
  switchWorkspace: (input) => ipcRenderer.invoke(switchWorkspaceChannel, input),
  getWorkspaceCharts: () => ipcRenderer.invoke(getWorkspaceChartsChannel),
  getWorkspaceCards: () => ipcRenderer.invoke(getWorkspaceCardsChannel),
  getWorkspaceTable: () => ipcRenderer.invoke(getWorkspaceTableChannel),
  getWorkspaceFrontmatterCategoryChoices: () =>
    ipcRenderer.invoke(getWorkspaceFrontmatterCategoryChoicesChannel),
  getWorkspaceChronicleCalendarSettings: () =>
    ipcRenderer.invoke(getWorkspaceChronicleCalendarSettingsChannel),
  saveWorkspaceFrontmatterCategoryChoices: (input) =>
    ipcRenderer.invoke(saveWorkspaceFrontmatterCategoryChoicesChannel, input),
  saveWorkspaceChronicleCalendarSettings: (input) =>
    ipcRenderer.invoke(saveWorkspaceChronicleCalendarSettingsChannel, input),
  saveWorkspaceTablePreferences: (input) =>
    ipcRenderer.invoke(saveWorkspaceTablePreferencesChannel, input),
  onWorkspaceChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: unknown): void => {
      const sanitized = sanitizeWorkspaceChangedEvent(payload);
      if (sanitized) callback(sanitized);
    };

    ipcRenderer.on(workspaceChangedChannel, listener);
    return () => ipcRenderer.removeListener(workspaceChangedChannel, listener);
  },
  onWorkspaceWatcherStatus: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: WorkspaceWatcherStatusEvent): void => {
      callback(payload);
    };

    ipcRenderer.on(workspaceWatcherStatusChannel, listener);
    return () => ipcRenderer.removeListener(workspaceWatcherStatusChannel, listener);
  }
};
