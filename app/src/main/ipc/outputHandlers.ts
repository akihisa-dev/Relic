import {
  copyDiagramSvgChannel,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel
} from "../../shared/ipc";
import {
  copyDiagramSvg,
  saveDiagramSvg
} from "./diagramOutputHandlers";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { savePreviewAsPdf } from "./previewPdfHandler";

export function registerOutputHandlers(): void {
  handleLocalizedIpc(savePreviewAsPdfChannel, savePreviewAsPdf);
  handleLocalizedIpc(saveDiagramSvgChannel, saveDiagramSvg);
  handleLocalizedIpc(copyDiagramSvgChannel, copyDiagramSvg);
}
