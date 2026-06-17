export const savePreviewAsPdfChannel = "output:savePreviewAsPdf";
export const printPreviewChannel = "output:printPreview";
export const saveDiagramSvgChannel = "output:saveDiagramSvg";
export const copyDiagramSvgChannel = "output:copyDiagramSvg";
export const previewOutputHtmlMaxBytes = 2 * 1024 * 1024;

export type OutputDiagramLanguage = "d2" | "mermaid";

export interface SavePreviewAsPdfInput {
  defaultFileName: string;
  html: string;
  title: string;
}

export interface PrintPreviewInput {
  html: string;
  title: string;
}

export interface SaveDiagramSvgInput {
  defaultFileName: string;
  language: OutputDiagramLanguage;
  svg: string;
}

export interface CopyDiagramSvgInput {
  language: OutputDiagramLanguage;
  svg: string;
}

export interface OutputSavedResult {
  filePath?: string;
  status: "saved" | "canceled";
}

export interface OutputPrintResult {
  status: "printed" | "canceled";
}

export interface OutputCopyResult {
  status: "copied";
}
