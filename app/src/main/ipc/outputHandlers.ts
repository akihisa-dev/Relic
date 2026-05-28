import { BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import { writeFile } from "node:fs/promises";

import {
  copyDiagramSvgChannel,
  printPreviewChannel,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel,
  type CopyDiagramSvgInput,
  type OutputCopyResult,
  type OutputPrintResult,
  type OutputSavedResult,
  type PrintPreviewInput,
  type SaveDiagramSvgInput,
  type SavePreviewAsPdfInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";

const defaultPdfName = "relic-preview";
const defaultSvgName = "relic-diagram";

export function registerOutputHandlers(): void {
  ipcMain.handle(
    savePreviewAsPdfChannel,
    async (event, input: unknown): Promise<RelicResult<OutputSavedResult>> => {
      try {
        if (!isSavePreviewAsPdfInput(input)) {
          return fail("OUTPUT_PDF_INVALID_INPUT", "PDF保存の内容が無効です。");
        }

        const saveOptions = {
          buttonLabel: "保存",
          defaultPath: ensureExtension(sanitizeFileName(input.defaultFileName || input.title || defaultPdfName), "pdf"),
          filters: [{ extensions: ["pdf"], name: "PDF" }],
          properties: ["createDirectory", "showOverwriteConfirmation"],
          title: "PDFとして保存"
        } satisfies Electron.SaveDialogOptions;
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const selection = parentWindow
          ? await dialog.showSaveDialog(parentWindow, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (selection.canceled || !selection.filePath) {
          return ok({ status: "canceled" });
        }

        const pdf = await renderHtmlToPdf(input.html, input.title);
        await writeFile(selection.filePath, pdf);

        return ok({ filePath: selection.filePath, status: "saved" });
      } catch (error) {
        return fail("OUTPUT_PDF_FAILED", "PDFとして保存できませんでした。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    printPreviewChannel,
    async (_event, input: unknown): Promise<RelicResult<OutputPrintResult>> => {
      try {
        if (!isPrintPreviewInput(input)) {
          return fail("OUTPUT_PRINT_INVALID_INPUT", "印刷内容が無効です。");
        }

        return await printHtml(input.html, input.title);
      } catch (error) {
        return fail("OUTPUT_PRINT_FAILED", "印刷できませんでした。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    saveDiagramSvgChannel,
    async (event, input: unknown): Promise<RelicResult<OutputSavedResult>> => {
      try {
        if (!isSaveDiagramSvgInput(input)) {
          return fail("OUTPUT_SVG_INVALID_INPUT", "SVG保存の内容が無効です。");
        }

        if (!hasRenderableSvg(input.svg)) {
          return fail("OUTPUT_SVG_EMPTY", "保存できるSVGがありません。");
        }

        const saveOptions = {
          buttonLabel: "保存",
          defaultPath: ensureExtension(sanitizeFileName(input.defaultFileName || defaultSvgName), "svg"),
          filters: [{ extensions: ["svg"], name: "SVG" }],
          properties: ["createDirectory", "showOverwriteConfirmation"],
          title: "SVGとして保存"
        } satisfies Electron.SaveDialogOptions;
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const selection = parentWindow
          ? await dialog.showSaveDialog(parentWindow, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (selection.canceled || !selection.filePath) {
          return ok({ status: "canceled" });
        }

        await writeFile(selection.filePath, input.svg, "utf8");

        return ok({ filePath: selection.filePath, status: "saved" });
      } catch (error) {
        return fail("OUTPUT_SVG_SAVE_FAILED", "SVGとして保存できませんでした。", ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    copyDiagramSvgChannel,
    async (_event, input: unknown): Promise<RelicResult<OutputCopyResult>> => {
      try {
        if (!isCopyDiagramSvgInput(input)) {
          return fail("OUTPUT_SVG_COPY_INVALID_INPUT", "SVGコピーの内容が無効です。");
        }

        if (!hasRenderableSvg(input.svg)) {
          return fail("OUTPUT_SVG_EMPTY", "コピーできるSVGがありません。");
        }

        clipboard.writeText(input.svg);

        return ok({ status: "copied" });
      } catch (error) {
        return fail("OUTPUT_SVG_COPY_FAILED", "SVGをコピーできませんでした。", ipcErrorDetails(error));
      }
    }
  );
}

async function renderHtmlToPdf(html: string, title: string): Promise<Buffer> {
  const window = createOutputWindow(title);

  try {
    await loadOutputHtml(window, html);
    return await window.webContents.printToPDF({
      displayHeaderFooter: false,
      generateDocumentOutline: true,
      margins: { bottom: 48, left: 52, marginType: "custom", right: 52, top: 48 },
      pageSize: "A4",
      preferCSSPageSize: true,
      printBackground: true
    });
  } finally {
    destroyOutputWindow(window);
  }
}

async function printHtml(html: string, title: string): Promise<RelicResult<OutputPrintResult>> {
  const window = createOutputWindow(title);

  try {
    await loadOutputHtml(window, html);

    return await new Promise<RelicResult<OutputPrintResult>>((resolve) => {
      window.webContents.print(
        {
          pageSize: "A4",
          printBackground: true,
          silent: false
        },
        (success, failureReason) => {
          if (success) {
            resolve(ok({ status: "printed" }));
            return;
          }

          if (isPrintCanceled(failureReason)) {
            resolve(ok({ status: "canceled" }));
            return;
          }

          resolve(fail("OUTPUT_PRINT_FAILED", "印刷できませんでした。", failureReason));
        }
      );
    });
  } finally {
    destroyOutputWindow(window);
  }
}

function createOutputWindow(title: string): BrowserWindow {
  const window = new BrowserWindow({
    height: 900,
    show: false,
    title,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    },
    width: 780
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("data:text/html")) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  return window;
}

async function loadOutputHtml(window: BrowserWindow, html: string): Promise<void> {
  const encoded = Buffer.from(html, "utf8").toString("base64");
  await window.loadURL(`data:text/html;base64,${encoded}`);
}

function destroyOutputWindow(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.destroy();
}

function isSavePreviewAsPdfInput(input: unknown): input is SavePreviewAsPdfInput {
  return isObject(input) &&
    typeof input.defaultFileName === "string" &&
    typeof input.html === "string" &&
    input.html.trim() !== "" &&
    typeof input.title === "string";
}

function isPrintPreviewInput(input: unknown): input is PrintPreviewInput {
  return isObject(input) &&
    typeof input.html === "string" &&
    input.html.trim() !== "" &&
    typeof input.title === "string";
}

function isSaveDiagramSvgInput(input: unknown): input is SaveDiagramSvgInput {
  return isObject(input) &&
    typeof input.defaultFileName === "string" &&
    isOutputDiagramLanguage(input.language) &&
    typeof input.svg === "string";
}

function isCopyDiagramSvgInput(input: unknown): input is CopyDiagramSvgInput {
  return isObject(input) &&
    isOutputDiagramLanguage(input.language) &&
    typeof input.svg === "string";
}

function isOutputDiagramLanguage(value: unknown): value is SaveDiagramSvgInput["language"] {
  return value === "d2" || value === "mermaid";
}

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return sanitized || defaultPdfName;
}

function ensureExtension(fileName: string, extension: "pdf" | "svg"): string {
  return fileName.toLowerCase().endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;
}

function hasRenderableSvg(svg: string): boolean {
  const match = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i.exec(svg.trim());
  return Boolean(match?.[1].trim());
}

function isPrintCanceled(failureReason: string): boolean {
  return /cancel|abort/i.test(failureReason);
}

function ipcErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
