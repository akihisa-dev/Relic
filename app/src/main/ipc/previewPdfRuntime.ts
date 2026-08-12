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
  const encoded = Buffer.from(html, "utf8").toString("base64");
  const initialUrl = `data:text/html;base64,${encoded}`;
  const runtime = createPreviewPdfWindow(title, initialUrl);

  try {
    await runtime.window.loadURL(initialUrl);
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

function createPreviewPdfWindow(title: string, initialUrl: string): PreviewPdfWindowRuntime {
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
  let initialNavigationAllowed = true;
  const disposeSecurityPolicy = installWindowSecurityPolicy(window, {
    isNavigationAllowed: (url) => {
      if (!initialNavigationAllowed || url !== initialUrl) return false;
      initialNavigationAllowed = false;
      return true;
    }
  });

  return { disposeSecurityPolicy, window };
}

function destroyPreviewPdfWindow(window: BrowserWindow): void {
  if (!window.isDestroyed()) window.destroy();
}
