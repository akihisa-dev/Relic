import { readFile, stat } from "node:fs/promises";

import { isSupportedPdfPath } from "../../shared/pdfFiles";
import { fail, ok, type RelicResult } from "../../shared/result";
import { errorDetails } from "./fileSystem";
import { resolveExistingWorkspacePath } from "./paths";

export interface ReadPdfFile {
  dataUrl: string;
}

export interface PdfFileOperations {
  readFile: typeof readFile;
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

    const pdfBuffer = await ops.readFile(resolvedPath.value);
    return ok({ dataUrl: `data:application/pdf;base64,${pdfBuffer.toString("base64")}` });
  } catch (error) {
    return fail(
      "PDF_READ_FAILED",
      "PDFファイルを表示できませんでした。",
      errorDetails(error)
    );
  }
}
