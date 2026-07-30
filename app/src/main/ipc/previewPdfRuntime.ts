import { BrowserWindow } from "electron";

import type { OutputPdfOptions } from "../../shared/ipc";
import { installWindowSecurityPolicy } from "../windowSecurity";
import { outputSessionPartition } from "../windowOptions";

interface PreviewPdfWindowRuntime {
  disposeSecurityPolicy: () => void;
  window: BrowserWindow;
}

export async function renderPreviewHtmlToPdf(
  html: string,
  title: string,
  pdfOptions?: OutputPdfOptions
): Promise<Buffer> {
  const runtime = createPreviewPdfWindow(title);

  try {
    await loadPreviewOutputHtml(runtime.window, html);
    return await runtime.window.webContents.printToPDF({
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
    runtime.disposeSecurityPolicy();
    destroyPreviewPdfWindow(runtime.window);
  }
}

function createPreviewPdfWindow(title: string): PreviewPdfWindowRuntime {
  const window = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    height: 900,
    show: false,
    title,
    webPreferences: {
      allowRunningInsecureContent: false,
      contextIsolation: true,
      javascript: false,
      nodeIntegration: false,
      partition: outputSessionPartition,
      sandbox: true,
      webSecurity: true
    },
    width: 780
  });
  const disposeSecurityPolicy = installWindowSecurityPolicy(window, {
    isNavigationAllowed: (url) => url.startsWith("data:text/html")
  });

  return { disposeSecurityPolicy, window };
}

async function loadPreviewOutputHtml(window: BrowserWindow, html: string): Promise<void> {
  const encoded = Buffer.from(html, "utf8").toString("base64");
  await window.loadURL(`data:text/html;base64,${encoded}`);
}

function destroyPreviewPdfWindow(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.destroy();
}
