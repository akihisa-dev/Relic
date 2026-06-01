import { BrowserWindow, clipboard, dialog, ipcMain } from "electron";

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

        if (!hasRenderableSvg(input.svg)) {
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

        await atomicWriteTextFile(selection.filePath, input.svg);

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

        if (!hasRenderableSvg(input.svg)) {
          return fail("OUTPUT_SVG_EMPTY", t("output.svgEmptyCopy"));
        }

        clipboard.writeText(input.svg);

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
  const window = createOutputWindow(`${title} - ${t("output.print")}`, { allowInlineScripts: true, parentWindow });

  await loadOutputHtml(window, buildPrintPreviewHtml(html, t));
  window.show();
  window.focus();

  return ok({ status: "printed" });
}

function createOutputWindow(
  title: string,
  options: { allowInlineScripts: boolean; parentWindow?: BrowserWindow | null }
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

function buildPrintPreviewHtml(html: string, t: Translator): string {
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "script-src 'unsafe-inline'",
    "img-src data:",
    "font-src data:"
  ].join("; ");
  const toolbar = [
    `<div class="relic-print-preview-toolbar" role="region" aria-label="${escapeHtml(t("output.printDialogControls"))}">`,
    `<button type="button" data-relic-print>${escapeHtml(t("output.printDialogButton"))}</button>`,
    `<button type="button" data-relic-close>${escapeHtml(t("output.printDialogClose"))}</button>`,
    "</div>"
  ].join("");
  const toolbarCss = `
.relic-print-preview-toolbar {
  align-items: center;
  background: #ffffff;
  border-bottom: 1px solid #d4d4d8;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  box-sizing: border-box;
  display: flex;
  gap: 8px;
  left: 0;
  padding: 8px 12px;
  position: sticky;
  right: 0;
  top: 0;
  z-index: 10;
}

.relic-print-preview-toolbar button {
  background: #18181b;
  border: 1px solid #18181b;
  border-radius: 6px;
  color: #ffffff;
  cursor: pointer;
  font: 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.4;
  padding: 6px 10px;
}

.relic-print-preview-toolbar button[data-relic-close] {
  background: #ffffff;
  color: #18181b;
}

@media print {
  .relic-print-preview-toolbar {
    display: none !important;
  }
}
`;
  const script = `
<script>
(() => {
  const openPrintDialog = () => window.print();
  document.querySelector("[data-relic-print]")?.addEventListener("click", openPrintDialog);
  document.querySelector("[data-relic-close]")?.addEventListener("click", () => window.close());
  setTimeout(openPrintDialog, 150);
})();
</script>`;

  return html
    .replace(
      /<meta http-equiv="Content-Security-Policy" content="[^"]*">/i,
      `<meta http-equiv="Content-Security-Policy" content="${csp}">`
    )
    .replace("</head>", `<style>${toolbarCss}</style></head>`)
    .replace("<body>", `<body>${toolbar}`)
    .replace("</body>", `${script}</body>`);
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

function hasRenderableSvg(svg: string): boolean {
  const match = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i.exec(svg.trim());
  return Boolean(match?.[1].trim());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function ipcErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
