import { readFile, realpath, stat } from "node:fs/promises";

import { isSupportedPdfPath } from "../../shared/pdfFiles";
import { maxPdfReadBytes } from "../../shared/ipc/files";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath, verifyExistingWorkspacePath, type RealpathOperations } from "./paths";

export interface ReadPdfFile {
  dataUrl: string;
}

export interface PdfFileOperations {
  readFile: typeof readFile;
  realpath?: RealpathOperations["realpath"];
  stat: typeof stat;
}

const defaultPdfFileOperations: PdfFileOperations = {
  readFile,
  stat
};

export async function readPdfFile(
  workspacePath: string,
  relativePath: string,
  operations: Partial<PdfFileOperations> = {}
): Promise<RelicResult<ReadPdfFile>> {
  const ops = { ...defaultPdfFileOperations, ...operations };

  if (!isSupportedPdfPath(relativePath)) {
    return fail("PDF_READ_TYPE_UNSUPPORTED", "対応しているPDFファイルだけを表示できます。");
  }

  const resolvedPath = await resolveExistingWorkspacePath(workspacePath, relativePath);
  if (!resolvedPath.ok) return resolvedPath;

  try {
    const fileStat = await ops.stat(resolvedPath.value);
    if (!fileStat.isFile()) {
      return fail("PDF_READ_INVALID_FILE", "表示できるPDFファイルを指定してください。");
    }
    if (!Number.isSafeInteger(fileStat.size) || fileStat.size < 0 || fileStat.size > maxPdfReadBytes) {
      return fail("PDF_READ_TOO_LARGE", "PDFファイルが大きすぎるため表示できません。", `上限: ${maxPdfReadBytes} bytes`);
    }

    const safeReadPath = await verifyExistingWorkspacePath(
      workspacePath,
      resolvedPath.value,
      ops.realpath ? { realpath: ops.realpath } : {}
    );
    if (!safeReadPath.ok) return safeReadPath;

    const readRealpath = ops.realpath ?? realpath;
    const identityBeforeRead = await readRealpath(safeReadPath.value);
    const pdfBuffer = await ops.readFile(safeReadPath.value);
    const identityAfterRead = await readRealpath(safeReadPath.value);
    if (identityAfterRead !== identityBeforeRead) {
      return fail("WORKSPACE_PATH_OUTSIDE", "読み込み中にPDFの実体が変更されたため表示できません。");
    }
    if (pdfBuffer.byteLength > maxPdfReadBytes) {
      return fail("PDF_READ_TOO_LARGE", "PDFファイルが大きすぎるため表示できません。", `上限: ${maxPdfReadBytes} bytes`);
    }
    return ok({ dataUrl: `data:application/pdf;base64,${pdfBuffer.toString("base64")}` });
  } catch (error) {
    return fail(
      "PDF_READ_FAILED",
      "PDFファイルを表示できませんでした。",
      errorDetails(error)
    );
  }
}
