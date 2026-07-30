import { ipcRenderer } from "electron";

import {
  generateTableOfContentsChannel,
  generateTagIndexChannel,
  generateTitleListChannel,
  mergeFilesChannel,
  type ToolsApi
} from "../../shared/ipc/tools";

export const toolsApiFragment: ToolsApi = {
  generateTitleList: (input) => ipcRenderer.invoke(generateTitleListChannel, input),
  generateTableOfContents: (input) =>
    ipcRenderer.invoke(generateTableOfContentsChannel, input),
  generateTagIndex: (input) => ipcRenderer.invoke(generateTagIndexChannel, input),
  mergeFiles: (input) => ipcRenderer.invoke(mergeFilesChannel, input)
};
