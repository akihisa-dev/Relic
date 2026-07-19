import { BrowserWindow, clipboard, dialog } from "electron";

import {
  copyDiagramSvgChannel,
  previewOutputHtmlMaxBytes,
  saveDiagramSvgChannel,
  savePreviewAsPdfChannel,
  type CopyDiagramSvgInput,
  type OutputPdfOptions,
  type OutputCopyResult,
  type OutputSavedResult,
  type SaveDiagramSvgInput,
  type SavePreviewAsPdfInput
} from "../../shared/ipc";
import { maxSvgInputBytes } from "../../shared/ipc/output";
import { fail, ok, type RelicResult } from "../../shared/result";
import { redactSensitiveText } from "../../shared/securityRedaction";
import { atomicWriteFile, atomicWriteTextFile } from "../files/atomicWrite";
import { getMainTranslator } from "../i18n";
import { outputSessionPartition } from "../windowOptions";
import { handleLocalizedIpc } from "./localizedIpcHandler";
import { hasRenderableSvg, sanitizeOutputSvg } from "./sanitizeOutputSvg";

const defaultPdfName = "relic-preview";
const defaultSvgName = "relic-diagram";

export function registerOutputHandlers(): void {
  handleLocalizedIpc(
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

        const pdf = await renderHtmlToPdf(input.html, input.title, input.pdfOptions);
        await atomicWriteFile(selection.filePath, pdf);

        return ok({ filePath: selection.filePath, status: "saved" });
      } catch (error) {
        return fail("OUTPUT_PDF_FAILED", t("output.pdfSaveFailed"), ipcErrorDetails(error));
      }
    }
  );

  handleLocalizedIpc(
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

  handleLocalizedIpc(
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

async function renderHtmlToPdf(html: string, title: string, pdfOptions?: OutputPdfOptions): Promise<Buffer> {
  const window = createOutputWindow(title, {
    allowDataHtmlNavigation: true,
    allowInlineScripts: false
  });

  try {
    await loadOutputHtml(window, html);
    return await window.webContents.printToPDF({
      displayHeaderFooter: false,
      generateDocumentOutline: true,
      ...(pdfOptions ? {
        landscape: pdfOptions.landscape,
        margins: {
          marginType: pdfOptions.marginType,
          ...pdfOptions.margins
        },
        pageSize: pdfOptions.pageSize,
        scaleFactor: pdfOptions.scaleFactor
      } : { pageSize: "A4" }),
      preferCSSPageSize: true,
      printBackground: true
    });
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
  }
): BrowserWindow {
  const window = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    height: 900,
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
    isOptionalOutputPdfOptions(input.pdfOptions) &&
    typeof input.title === "string";
}

function isOptionalOutputPdfOptions(value: unknown): value is OutputPdfOptions | undefined {
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

function isWithinUtf8ByteLimit(value: string, maxBytes: number): boolean {
  return Buffer.byteLength(value, "utf8") <= maxBytes;
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
    /<meta\b[^>]*http-equiv\s*=\s*(["'])refresh\1/i.test(html) ||
    /\son[a-z]+\s*=/i.test(html) ||
    /\bstyle\s*=\s*(["'])[\s\S]*?(?:url\s*\(|@import)[\s\S]*?\1/i.test(html) ||
    /\b(?:href|src|xlink:href)\s*=\s*(["'])\s*(?:javascript|file):/i.test(html) ||
    /\b(?:href|src|xlink:href)\s*=\s*(?:javascript|file):/i.test(html);
}

function isSaveDiagramSvgInput(input: unknown): input is SaveDiagramSvgInput {
  return isObject(input) &&
    typeof input.defaultFileName === "string" &&
    isOutputDiagramLanguage(input.language) &&
    typeof input.svg === "string" &&
    isWithinUtf8ByteLimit(input.svg, maxSvgInputBytes);
}

function isCopyDiagramSvgInput(input: unknown): input is CopyDiagramSvgInput {
  return isObject(input) &&
    isOutputDiagramLanguage(input.language) &&
    typeof input.svg === "string" &&
    isWithinUtf8ByteLimit(input.svg, maxSvgInputBytes);
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

function ipcErrorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message);
}
