import {
  previewOutputHtmlMaxBytes,
  type OutputPdfOptions,
  type SavePreviewAsPdfInput
} from "../../shared/ipc";
import {
  isOutputRecord,
  isWithinOutputUtf8ByteLimit
} from "./outputHandlerHelpers";

export function isSavePreviewAsPdfInput(input: unknown): input is SavePreviewAsPdfInput {
  return isOutputRecord(input) &&
    typeof input.defaultFileName === "string" &&
    typeof input.html === "string" &&
    isWithinOutputUtf8ByteLimit(input.html, previewOutputHtmlMaxBytes) &&
    isSafePreviewOutputHtml(input.html) &&
    isOptionalOutputPdfOptions(input.pdfOptions) &&
    typeof input.title === "string";
}

function isOptionalOutputPdfOptions(value: unknown): value is OutputPdfOptions | undefined {
  if (value === undefined) return true;
  if (!isOutputRecord(value)) return false;
  if (typeof value.landscape !== "boolean") return false;
  if (value.marginType !== "custom" && value.marginType !== "none") return false;
  if (value.pageSize !== "A4" && value.pageSize !== "A3" && value.pageSize !== "Letter" && value.pageSize !== "Legal") {
    return false;
  }
  if (
    typeof value.scaleFactor !== "number" ||
    !Number.isFinite(value.scaleFactor) ||
    value.scaleFactor < 0.1 ||
    value.scaleFactor > 2
  ) {
    return false;
  }
  const margins = value.margins;
  if (!isOutputRecord(margins)) return false;

  return ["top", "right", "bottom", "left"].every((key) => {
    const margin = margins[key];
    return typeof margin === "number" &&
      Number.isFinite(margin) &&
      margin >= 0 &&
      margin <= 2;
  });
}

function isSafePreviewOutputHtml(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed === "") return false;
  if (!/^<!doctype html>/i.test(trimmed)) return false;
  if (!/<html\b[^>]*>/i.test(trimmed) || !/<head\b[^>]*>/i.test(trimmed) || !/<body\b[^>]*>/i.test(trimmed)) {
    return false;
  }
  if (!/<main\b[^>]*class=(["'])[^"']*\brelic-output-body\b[^"']*\1/i.test(trimmed)) {
    return false;
  }
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
