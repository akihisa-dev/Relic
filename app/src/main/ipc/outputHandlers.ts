import { BrowserWindow, app, clipboard, dialog, ipcMain } from "electron";
import { mkdir, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  copyDiagramSvgChannel,
  printHtmlChannel,
  printPreviewChannel,
  previewOutputHtmlMaxBytes,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel,
  type CopyDiagramSvgInput,
  type OutputPrintOptions,
  type OutputCopyResult,
  type OutputPrintResult,
  type OutputSavedResult,
  type PrintHtmlInput,
  type PrintPreviewInput,
  type SaveDiagramSvgInput,
  type SavePreviewAsPdfInput
} from "../../shared/ipc";
import { fail, ok, type RelicResult } from "../../shared/result";
import type { Translator } from "../../shared/i18n";
import { redactSensitiveText } from "../../shared/securityRedaction";
import { atomicWriteFile, atomicWriteTextFile } from "../files/atomicWrite";
import { getMainTranslator } from "../i18n";
import { outputSessionPartition } from "../windowOptions";
import { hasRenderableSvg, sanitizeOutputSvg } from "./sanitizeOutputSvg";

const defaultPdfName = "relic-preview";
const defaultSvgName = "relic-diagram";
const printPreviewTemporaryDirectoryName = "relic-print-preview";

export function registerOutputHandlers(): void {
  void cleanupTemporaryPrintPreviewFiles();

  ipcMain.handle(
    savePreviewAsPdfChannel,
    async (event, input: unknown): Promise<RelicResult<OutputSavedResult>> => {
      const t = await getMainTranslator();
      try {
        if (!isSavePreviewAsPdfInput(input)) {
          return fail("OUTPUT_PDF_INVALID_INPUT", t("output.pdfInvalidInput"));
        }

        const saveOptions = {
          buttonLabel: t("common.save"),
          defaultPath: ensureExtension(sanitizeFileName(input.defaultFileName || input.title || defaultPdfName, defaultPdfName), "pdf"),
          filters: [{ extensions: ["pdf"], name: "PDF" }],
          properties: ["createDirectory", "showOverwriteConfirmation"],
          title: t("output.pdfDialogTitle")
        } satisfies Electron.SaveDialogOptions;
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const selection = parentWindow
          ? await dialog.showSaveDialog(parentWindow, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (selection.canceled || !selection.filePath) {
          return ok({ status: "canceled" });
        }

        const pdf = await renderHtmlToPdf(input.html, input.title, input.printOptions);
        await atomicWriteFile(selection.filePath, pdf);

        return ok({ filePath: selection.filePath, status: "saved" });
      } catch (error) {
        return fail("OUTPUT_PDF_FAILED", t("output.pdfSaveFailed"), ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    printHtmlChannel,
    async (_event, input: unknown): Promise<RelicResult<OutputPrintResult>> => {
      const t = await getMainTranslator();
      try {
        if (!isPrintHtmlInput(input)) {
          return fail("OUTPUT_PRINT_INVALID_INPUT", t("output.printInvalidInput"));
        }

        return await printHtml(input.html, input.title, input.printOptions);
      } catch (error) {
        return fail("OUTPUT_PRINT_FAILED", t("output.printFailed"), ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    printPreviewChannel,
    async (event, input: unknown): Promise<RelicResult<OutputPrintResult>> => {
      const t = await getMainTranslator();
      try {
        if (!isPrintPreviewInput(input)) {
          return fail("OUTPUT_PRINT_INVALID_INPUT", t("output.printInvalidInput"));
        }

        return await openPrintPreview(input.html, input.title, input.printOptions, BrowserWindow.fromWebContents(event.sender), t);
      } catch (error) {
        return fail("OUTPUT_PRINT_FAILED", t("output.printFailed"), ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    saveDiagramSvgChannel,
    async (event, input: unknown): Promise<RelicResult<OutputSavedResult>> => {
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
          defaultPath: ensureExtension(sanitizeFileName(input.defaultFileName || defaultSvgName, defaultSvgName), "svg"),
          filters: [{ extensions: ["svg"], name: "SVG" }],
          properties: ["createDirectory", "showOverwriteConfirmation"],
          title: t("output.saveSvgDialogTitle")
        } satisfies Electron.SaveDialogOptions;
        const parentWindow = BrowserWindow.fromWebContents(event.sender);
        const selection = parentWindow
          ? await dialog.showSaveDialog(parentWindow, saveOptions)
          : await dialog.showSaveDialog(saveOptions);

        if (selection.canceled || !selection.filePath) {
          return ok({ status: "canceled" });
        }

        await atomicWriteTextFile(selection.filePath, sanitizedSvg);

        return ok({ filePath: selection.filePath, status: "saved" });
      } catch (error) {
        return fail("OUTPUT_SVG_SAVE_FAILED", t("output.svgSaveFailed"), ipcErrorDetails(error));
      }
    }
  );

  ipcMain.handle(
    copyDiagramSvgChannel,
    async (_event, input: unknown): Promise<RelicResult<OutputCopyResult>> => {
      const t = await getMainTranslator();
      try {
        if (!isCopyDiagramSvgInput(input)) {
          return fail("OUTPUT_SVG_COPY_INVALID_INPUT", t("output.svgCopyInvalidInput"));
        }

        const sanitizedSvg = sanitizeOutputSvg(input.svg);

        if (!hasRenderableSvg(sanitizedSvg)) {
          return fail("OUTPUT_SVG_EMPTY", t("output.svgEmptyCopy"));
        }

        clipboard.writeText(sanitizedSvg);

        return ok({ status: "copied" });
      } catch (error) {
        return fail("OUTPUT_SVG_COPY_FAILED", t("output.svgCopyFailed"), ipcErrorDetails(error));
      }
    }
  );
}

export async function cleanupTemporaryPrintPreviewFiles(): Promise<void> {
  const directoryPath = temporaryPrintPreviewDirectoryPath();
  await rm(directoryPath, { force: true, recursive: true }).catch(() => undefined);
  await mkdir(directoryPath, { recursive: true }).catch(() => undefined);
}

async function renderHtmlToPdf(html: string, title: string, printOptions?: OutputPrintOptions): Promise<Buffer> {
  const window = createOutputWindow(title, {
    allowDataHtmlNavigation: true,
    allowInlineScripts: false
  });

  try {
    await loadOutputHtml(window, html);
    return await window.webContents.printToPDF({
      displayHeaderFooter: false,
      generateDocumentOutline: true,
      ...(printOptions ? {
        landscape: printOptions.landscape,
        margins: {
          marginType: printOptions.marginType,
          ...printOptions.margins
        },
        pageSize: printOptions.pageSize,
        scaleFactor: printOptions.scaleFactor
      } : { pageSize: "A4" }),
      preferCSSPageSize: true,
      printBackground: true
    });
  } finally {
    destroyOutputWindow(window);
  }
}

async function openPrintPreview(
  html: string,
  title: string,
  printOptions: OutputPrintOptions | undefined,
  parentWindow: BrowserWindow | null,
  t: Translator
): Promise<RelicResult<OutputPrintResult>> {
  const [pdf, pdfPath] = await Promise.all([
    renderHtmlToPdf(html, title, printOptions),
    temporaryPrintPreviewPath()
  ]);
  await atomicWriteFile(pdfPath, pdf);
  const pdfUrl = pathToFileURL(pdfPath).toString();
  const window = createOutputWindow(`${title} - ${t("output.print")}`, {
    allowInlineScripts: true,
    allowedNavigation: (url) => url === pdfUrl,
    parentWindow
  });

  window.on("closed", () => {
    void unlink(pdfPath).catch(() => undefined);
  });

  try {
    await window.loadURL(pdfUrl);
    window.show();
    window.focus();
  } catch (error) {
    destroyOutputWindow(window);
    await unlink(pdfPath).catch(() => undefined);
    throw error;
  }

  return ok({ status: "printed" });
}

async function printHtml(
  html: string,
  title: string,
  printOptions: OutputPrintOptions | undefined
): Promise<RelicResult<OutputPrintResult>> {
  const window = createOutputWindow(title, {
    allowDataHtmlNavigation: true,
    allowInlineScripts: false
  });

  try {
    await loadOutputHtml(window, html);
    const printed = await new Promise<{ failureReason?: string; success: boolean }>((resolve) => {
      window.webContents.print({
        landscape: printOptions?.landscape,
        margins: printOptions ? {
          marginType: printOptions.marginType,
          ...printOptions.margins
        } : undefined,
        pageSize: printOptions?.pageSize,
        printBackground: true,
        scaleFactor: printOptions?.scaleFactor,
        silent: false
      }, (success, failureReason) => {
        resolve({ failureReason, success });
      });
    });

    if (!printed.success) {
      return printed.failureReason === "cancelled"
        ? ok({ status: "canceled" })
        : fail("OUTPUT_PRINT_FAILED", printed.failureReason || "Print failed");
    }

    return ok({ status: "printed" });
  } finally {
    destroyOutputWindow(window);
  }
}

function createOutputWindow(
  title: string,
  options: {
    allowInlineScripts: boolean;
    allowDataHtmlNavigation?: boolean;
    allowedNavigation?: (url: string) => boolean;
    parentWindow?: BrowserWindow | null;
  }
): BrowserWindow {
  const window = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    height: 900,
    parent: options.parentWindow ?? undefined,
    show: false,
    title,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      javascript: options.allowInlineScripts,
      nodeIntegration: false,
      partition: outputSessionPartition,
      sandbox: true,
      webSecurity: true
    },
    width: 780
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (options.allowDataHtmlNavigation && url.startsWith("data:text/html")) return;
    if (!options.allowedNavigation?.(url)) event.preventDefault();
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
    isWithinPreviewHtmlLimit(input.html) &&
    isSafePreviewOutputHtml(input.html) &&
    isOptionalOutputPrintOptions(input.printOptions) &&
    typeof input.title === "string";
}

function isPrintPreviewInput(input: unknown): input is PrintPreviewInput {
  return isObject(input) &&
    typeof input.html === "string" &&
    isWithinPreviewHtmlLimit(input.html) &&
    isSafePreviewOutputHtml(input.html) &&
    isOptionalOutputPrintOptions(input.printOptions) &&
    typeof input.title === "string";
}

function isPrintHtmlInput(input: unknown): input is PrintHtmlInput {
  return isPrintPreviewInput(input);
}

function isOptionalOutputPrintOptions(value: unknown): value is OutputPrintOptions | undefined {
  if (value === undefined) return true;
  if (!isObject(value)) return false;
  if (typeof value.landscape !== "boolean") return false;
  if (value.marginType !== "custom" && value.marginType !== "none") return false;
  if (value.pageSize !== "A4" && value.pageSize !== "A3" && value.pageSize !== "Letter" && value.pageSize !== "Legal") return false;
  if (typeof value.scaleFactor !== "number" || !Number.isFinite(value.scaleFactor) || value.scaleFactor < 0.1 || value.scaleFactor > 2) return false;
  if (!isObject(value.margins)) return false;
  const margins = value.margins;
  return ["top", "right", "bottom", "left"].every((key) => {
    const margin = margins[key];
    return typeof margin === "number" && Number.isFinite(margin) && margin >= 0 && margin <= 2;
  });
}

function isWithinPreviewHtmlLimit(html: string): boolean {
  return Buffer.byteLength(html, "utf8") <= previewOutputHtmlMaxBytes;
}

function isSafePreviewOutputHtml(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed === "") return false;
  if (!/^<!doctype html>/i.test(trimmed)) return false;
  if (!/<html\b[^>]*>/i.test(trimmed) || !/<head\b[^>]*>/i.test(trimmed) || !/<body\b[^>]*>/i.test(trimmed)) {
    return false;
  }
  if (!/<main\b[^>]*class=(["'])[^"']*\brelic-output-body\b[^"']*\1/i.test(trimmed)) return false;
  if (!hasRequiredOutputCsp(trimmed)) return false;

  return !hasUnsafeOutputHtml(trimmed);
}

function hasRequiredOutputCsp(html: string): boolean {
  return Array.from(html.matchAll(/<meta\b[^>]*>/gi)).some(([tag]) => {
    const httpEquiv = /\bhttp-equiv\s*=\s*(["'])content-security-policy\1/i.test(tag);
    const content = /\bcontent\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag)?.[2] ?? "";
    return httpEquiv && /\bdefault-src\s+'none'/.test(content);
  });
}

function hasUnsafeOutputHtml(html: string): boolean {
  return /<(?:script|iframe|object|embed|webview|link|base)\b/i.test(html) ||
    /<meta\b[^>]*http-equiv=(["'])refresh\1/i.test(html) ||
    /\son[a-z]+\s*=/i.test(html) ||
    /\b(?:href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|file):/i.test(html) ||
    /\b(?:href|src|xlink:href)\s*=\s*(?:javascript|file):/i.test(html);
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

function sanitizeFileName(value: string, fallbackName: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return sanitized || fallbackName;
}

function ensureExtension(fileName: string, extension: "pdf" | "svg"): string {
  return fileName.toLowerCase().endsWith(`.${extension}`) ? fileName : `${fileName}.${extension}`;
}

async function temporaryPrintPreviewPath(): Promise<string> {
  const directoryPath = temporaryPrintPreviewDirectoryPath();
  await mkdir(directoryPath, { recursive: true });

  return path.join(
    directoryPath,
    `preview-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  );
}

function temporaryPrintPreviewDirectoryPath(): string {
  return path.join(app.getPath("temp"), `${printPreviewTemporaryDirectoryName}-${process.pid}`);
}

function ipcErrorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message);
}
