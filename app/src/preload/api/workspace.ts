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
  saveWorkspaceChartsChannel,
  saveWorkspaceChronicleCalendarSettingsChannel,
  saveWorkspaceFrontmatterCategoryChoicesChannel,
  saveWorkspaceTablePreferencesChannel,
  switchWorkspaceChannel,
  togglePinChannel,
  updateChartEntryChannel,
  workspaceChangedChannel,
  workspaceWatcherStatusChannel,
  type WorkspaceApi,
  type WorkspaceChangedEvent,
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
  saveWorkspaceCharts: (input) => ipcRenderer.invoke(saveWorkspaceChartsChannel, input),
  saveWorkspaceTablePreferences: (input) =>
    ipcRenderer.invoke(saveWorkspaceTablePreferencesChannel, input),
  updateChartEntry: (input) => ipcRenderer.invoke(updateChartEntryChannel, input),
  onWorkspaceChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, payload: WorkspaceChangedEvent): void => {
      callback(payload);
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
