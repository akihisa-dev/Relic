import { BrowserWindow, app, clipboard, dialog, ipcMain } from "electron";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
import type { Translator } from "../../shared/i18n";
import { atomicWriteFile, atomicWriteTextFile } from "../files/atomicWrite";
import { getMainTranslator } from "../i18n";

const defaultPdfName = "relic-preview";
const defaultSvgName = "relic-diagram";
const outputSvgUriAttributes = new Set(["href", "xlink:href", "src"]);
const forbiddenOutputSvgTags = new Set(["foreignobject", "script"]);

export function registerOutputHandlers(): void {
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

        const pdf = await renderHtmlToPdf(input.html, input.title);
        await atomicWriteFile(selection.filePath, pdf);

        return ok({ filePath: selection.filePath, status: "saved" });
      } catch (error) {
        return fail("OUTPUT_PDF_FAILED", t("output.pdfSaveFailed"), ipcErrorDetails(error));
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

        return await openPrintPreview(input.html, input.title, BrowserWindow.fromWebContents(event.sender), t);
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

async function renderHtmlToPdf(html: string, title: string): Promise<Buffer> {
  const window = createOutputWindow(title, { allowInlineScripts: false });

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

async function openPrintPreview(
  html: string,
  title: string,
  parentWindow: BrowserWindow | null,
  t: Translator
): Promise<RelicResult<OutputPrintResult>> {
  const pdf = await renderHtmlToPdf(html, title);
  const pdfPath = temporaryPrintPreviewPath(title);
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

function createOutputWindow(
  title: string,
  options: {
    allowInlineScripts: boolean;
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
      sandbox: true,
      webSecurity: true
    },
    width: 780
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("data:text/html") && !options.allowedNavigation?.(url)) event.preventDefault();
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

function temporaryPrintPreviewPath(title: string): string {
  const fileName = ensureExtension(sanitizeFileName(title || defaultPdfName, defaultPdfName), "pdf");
  return path.join(
    app.getPath("temp"),
    `relic-print-preview-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}-${fileName}`
  );
}

function hasRenderableSvg(svg: string): boolean {
  const match = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i.exec(svg.trim());
  return Boolean(match?.[1].trim());
}

function sanitizeOutputSvg(svg: string): string {
  const match = /<svg\b[\s\S]*?<\/svg>/i.exec(svg.trim());
  if (!match) return "";

  return sanitizeOutputSvgMarkup(match[0]).trim();
}

function sanitizeOutputSvgMarkup(svg: string): string {
  let sanitized = svg;

  for (const tagName of forbiddenOutputSvgTags) {
    const forbiddenBlockPattern = new RegExp(
      `<\\s*${tagName}\\b[^>]*(?:\\/>|[\\s\\S]*?<\\s*\\/\\s*${tagName}\\s*>)`,
      "gi"
    );
    sanitized = sanitized.replace(forbiddenBlockPattern, "");
  }

  return sanitized.replace(/<([A-Za-z][\w:.-]*)([^<>]*?)(\/?)>/g, (_tag, tagName: string, rawAttributes: string, selfClosing: string) => {
    if (forbiddenOutputSvgTags.has(tagName.toLowerCase())) return "";
    const attributes = sanitizeOutputSvgAttributes(rawAttributes);
    return `<${tagName}${attributes}${selfClosing}>`;
  });
}

function sanitizeOutputSvgAttributes(rawAttributes: string): string {
  const sanitized: string[] = [];
  const attributePattern = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of rawAttributes.matchAll(attributePattern)) {
    const rawName = match[1] ?? "";
    const name = rawName.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (name.startsWith("on") || (outputSvgUriAttributes.has(name) && !isSafeOutputSvgUri(value))) {
      continue;
    }

    sanitized.push(match[0]);
  }

  return sanitized.join("");
}

function isSafeOutputSvgUri(value: string): boolean {
  const trimmed = value.trim();
  const scheme = trimmed.replace(/[\u0000-\u0020]+/g, "").match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();

  return scheme === undefined || scheme === "http" || scheme === "https" || scheme === "mailto";
}

function ipcErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
