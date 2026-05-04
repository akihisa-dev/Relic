import { contextBridge, ipcRenderer } from "electron";

import { getAppInfoChannel, type AppInfo, type RelicApi } from "../shared/ipc";
import type { RelicResult } from "../shared/result";

const relicApi: RelicApi = {
  getAppInfo: () => ipcRenderer.invoke(getAppInfoChannel) as Promise<RelicResult<AppInfo>>
};

contextBridge.exposeInMainWorld("relic", relicApi);
