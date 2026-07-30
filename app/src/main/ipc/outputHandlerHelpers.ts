import {
  BrowserWindow,
  dialog,
  type IpcMainInvokeEvent,
  type SaveDialogOptions
} from "electron";

import { redactSensitiveText } from "../../shared/securityRedaction";

export async function showOutputSaveDialog(
  event: IpcMainInvokeEvent,
  options: SaveDialogOptions
) {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  return parentWindow
    ? dialog.showSaveDialog(parentWindow, options)
    : dialog.showSaveDialog(options);
}

export function sanitizeOutputFileName(value: string, fallbackName: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return sanitized || fallbackName;
}

export function ensureOutputExtension(fileName: string, extension: "pdf" | "svg"): string {
  return fileName.toLowerCase().endsWith(`.${extension}`)
    ? fileName
    : `${fileName}.${extension}`;
}

export function outputIpcErrorDetails(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSensitiveText(message);
}

export function isOutputRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

export function isWithinOutputUtf8ByteLimit(value: string, maxBytes: number): boolean {
  return Buffer.byteLength(value, "utf8") <= maxBytes;
}
