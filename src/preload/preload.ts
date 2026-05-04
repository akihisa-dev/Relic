import { contextBridge, ipcRenderer } from "electron";

import {
  getAppInfoChannel,
  getWorkspaceStateChannel,
  openWorkspaceChannel,
  type AppInfo,
  type RelicApi,
  type WorkspaceState
} from "../shared/ipc";
import type { RelicResult } from "../shared/result";

const relicApi: RelicApi = {
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>,
  getWorkspaceState: () =>
    ipcRenderer.invoke(getWorkspaceStateChannel) as Promise<RelicResult<WorkspaceState>>,
  openWorkspace: () =>
    ipcRenderer.invoke(openWorkspaceChannel) as Promise<RelicResult<WorkspaceState>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
