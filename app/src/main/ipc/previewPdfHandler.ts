import type { IpcMainInvokeEvent } from "electron";

import {
  type OutputSavedResult
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteFile } from "../files/atomicWrite";
import { getMainTranslator } from "../i18n";
import {
  ensureOutputExtension,
  outputIpcErrorDetails,
  sanitizeOutputFileName,
  showOutputSaveDialog
} from "./outputHandlerHelpers";
import { renderPreviewHtmlToPdf } from "./previewPdfRuntime";
import { isSavePreviewAsPdfInput } from "./previewPdfValidator";

const defaultPdfName = "relic-preview";

export async function savePreviewAsPdf(
  event: IpcMainInvokeEvent,
  input: unknown
): Promise<RelicResult<OutputSavedResult>> {
  const t = await getMainTranslator();

  try {
    if (!isSavePreviewAsPdfInput(input)) {
      return fail("OUTPUT_PDF_INVALID_INPUT", t("output.pdfInvalidInput"));
    }

    const saveOptions = {
      buttonLabel: t("common.save"),
      defaultPath: ensureOutputExtension(
        sanitizeOutputFileName(
          input.defaultFileName || input.title || defaultPdfName,
          defaultPdfName
        ),
        "pdf"
      ),
      filters: [{ extensions: ["pdf"], name: "PDF" }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
      title: t("output.pdfDialogTitle")
    } satisfies Electron.SaveDialogOptions;
    const selection = await showOutputSaveDialog(event, saveOptions);

    if (selection.canceled || !selection.filePath) {
      return ok({ status: "canceled" });
    }

    const pdf = await renderPreviewHtmlToPdf(input.html, input.title, input.pdfOptions);
    await atomicWriteFile(selection.filePath, pdf);

    return ok({ filePath: selection.filePath, status: "saved" });
  } catch (error) {
    return fail(
      "OUTPUT_PDF_FAILED",
      t("output.pdfSaveFailed"),
      outputIpcErrorDetails(error)
    );
  }
}
