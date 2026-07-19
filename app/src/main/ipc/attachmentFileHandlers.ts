import {
  importImageFileChannel,
  type ImportImageFileInput,
  readImageFileChannel,
  type ReadImageFileInput,
  readPdfFileChannel,
  type ReadPdfFileInput
} from "../../shared/ipc";
import { fail } from "../../shared/result";
import { importImageFile, readImageFile } from "../files/imageFiles";
import { readPdfFile } from "../files/pdfFiles";
import { invalidateWorkspaceData } from "../files/workspaceDataInvalidation";
import { getActiveWorkspaceContext, ipcErrorDetails } from "./activeWorkspace";
import {
  isImportImageFileInput,
  isReadImageFileInput,
  isReadPdfFileInput
} from "./fileHandlerValidators";
import { handleLocalizedIpc } from "./localizedIpcHandler";

export function registerAttachmentFileHandlers(): void {
  handleLocalizedIpc(
    importImageFileChannel,
    async (_event, input: ImportImageFileInput) => {
      try {
        if (!isImportImageFileInput(input)) {
          return fail("IMAGE_IMPORT_INVALID_INPUT", "追加する画像ファイルを指定してください。");
        }
        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;

        const importedImage = await importImageFile(
          context.value.activeWorkspace.path,
          input.sourcePath,
          input.destinationFolder
        );
        if (importedImage.ok) invalidateWorkspaceData(context.value.activeWorkspace.id);
        return importedImage;
      } catch (error) {
        return fail("IMAGE_IMPORT_FAILED", "画像ファイルを追加できませんでした。", ipcErrorDetails(error));
      }
    }
  );

  handleLocalizedIpc(
    readImageFileChannel,
    async (_event, input: ReadImageFileInput) => {
      try {
        if (!isReadImageFileInput(input)) {
          return fail("IMAGE_READ_INVALID_INPUT", "表示する画像ファイルを指定してください。");
        }
        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;
        return readImageFile(context.value.activeWorkspace.path, input.path);
      } catch (error) {
        return fail("IMAGE_READ_FAILED", "画像ファイルを表示できませんでした。", ipcErrorDetails(error));
      }
    }
  );

  handleLocalizedIpc(
    readPdfFileChannel,
    async (_event, input: ReadPdfFileInput) => {
      try {
        if (!isReadPdfFileInput(input)) {
          return fail("PDF_READ_INVALID_INPUT", "表示するPDFファイルを指定してください。");
        }
        const context = await getActiveWorkspaceContext();
        if (!context.ok) return context;
        return readPdfFile(context.value.activeWorkspace.path, input.path);
      } catch (error) {
        return fail("PDF_READ_FAILED", "PDFファイルを表示できませんでした。", ipcErrorDetails(error));
      }
    }
  );
}
