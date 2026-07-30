import { ipcRenderer } from "electron";

import {
  copyDiagramSvgChannel,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel,
  type OutputApi
} from "../../shared/ipc/output";

export const outputApiFragment: OutputApi = {
  copyDiagramSvg: (input) => ipcRenderer.invoke(copyDiagramSvgChannel, input),
  saveDiagramSvg: (input) => ipcRenderer.invoke(saveDiagramSvgChannel, input),
  savePreviewAsPdf: (input) => ipcRenderer.invoke(savePreviewAsPdfChannel, input)
};
