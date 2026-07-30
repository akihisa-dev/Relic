import { clipboard, type IpcMainInvokeEvent } from "electron";

import {
  maxSvgInputBytes,
  type CopyDiagramSvgInput,
  type OutputCopyResult,
  type OutputSavedResult,
  type SaveDiagramSvgInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import { atomicWriteTextFile } from "../files/atomicWrite";
import { getMainTranslator } from "../i18n";
import {
  ensureOutputExtension,
  isOutputRecord,
  isWithinOutputUtf8ByteLimit,
  outputIpcErrorDetails,
  sanitizeOutputFileName,
  showOutputSaveDialog
} from "./outputHandlerHelpers";
import { hasRenderableSvg, sanitizeOutputSvg } from "./sanitizeOutputSvg";

const defaultSvgName = "relic-diagram";

export async function saveDiagramSvg(
  event: IpcMainInvokeEvent,
  input: unknown
): Promise<RelicResult<OutputSavedResult>> {
  const t = await getMainTranslator();

  try {
    if (!isSaveDiagramSvgInput(input)) {
      return fail("OUTPUT_SVG_INVALID_INPUT", t("output.svgInvalidInput"));
    }

    const sanitizedSvg = sanitizeOutputSvg(input.svg);

    if (!hasRenderableSvg(sanitizedSvg)) {
      return fail("OUTPUT_SVG_EMPTY", t("output.svgEmptySave"));
    }

    const saveOptions = {
      buttonLabel: t("common.save"),
      defaultPath: ensureOutputExtension(
        sanitizeOutputFileName(
          input.defaultFileName || defaultSvgName,
          defaultSvgName
        ),
        "svg"
      ),
      filters: [{ extensions: ["svg"], name: "SVG" }],
      properties: ["createDirectory", "showOverwriteConfirmation"],
      title: t("output.saveSvgDialogTitle")
    } satisfies Electron.SaveDialogOptions;
    const selection = await showOutputSaveDialog(event, saveOptions);

    if (selection.canceled || !selection.filePath) {
      return ok({ status: "canceled" });
    }

    await atomicWriteTextFile(selection.filePath, sanitizedSvg);

    return ok({ filePath: selection.filePath, status: "saved" });
  } catch (error) {
    return fail(
      "OUTPUT_SVG_SAVE_FAILED",
      t("output.svgSaveFailed"),
      outputIpcErrorDetails(error)
    );
  }
}

export async function copyDiagramSvg(
  _event: IpcMainInvokeEvent,
  input: unknown
): Promise<RelicResult<OutputCopyResult>> {
  const t = await getMainTranslator();

  try {
    if (!isCopyDiagramSvgInput(input)) {
      return fail(
        "OUTPUT_SVG_COPY_INVALID_INPUT",
        t("output.svgCopyInvalidInput")
      );
    }

    const sanitizedSvg = sanitizeOutputSvg(input.svg);

    if (!hasRenderableSvg(sanitizedSvg)) {
      return fail("OUTPUT_SVG_EMPTY", t("output.svgEmptyCopy"));
    }

    clipboard.writeText(sanitizedSvg);

    return ok({ status: "copied" });
  } catch (error) {
    return fail(
      "OUTPUT_SVG_COPY_FAILED",
      t("output.svgCopyFailed"),
      outputIpcErrorDetails(error)
    );
  }
}

function isSaveDiagramSvgInput(input: unknown): input is SaveDiagramSvgInput {
  return isOutputRecord(input) &&
    typeof input.defaultFileName === "string" &&
    isOutputDiagramLanguage(input.language) &&
    typeof input.svg === "string" &&
    isWithinOutputUtf8ByteLimit(input.svg, maxSvgInputBytes);
}

function isCopyDiagramSvgInput(input: unknown): input is CopyDiagramSvgInput {
  return isOutputRecord(input) &&
    isOutputDiagramLanguage(input.language) &&
    typeof input.svg === "string" &&
    isWithinOutputUtf8ByteLimit(input.svg, maxSvgInputBytes);
}

function isOutputDiagramLanguage(value: unknown): value is SaveDiagramSvgInput["language"] {
  return value === "d2" || value === "mermaid";
}
