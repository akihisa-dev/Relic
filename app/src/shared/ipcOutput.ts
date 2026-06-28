export const savePreviewAsPdfChannel = "output:savePreviewAsPdf";
export const saveDiagramSvgChannel = "output:saveDiagramSvg";
export const copyDiagramSvgChannel = "output:copyDiagramSvg";
export const previewOutputHtmlMaxBytes = 2 * 1024 * 1024;

export type OutputDiagramLanguage = "d2" | "mermaid";

export interface SavePreviewAsPdfInput {
  defaultFileName: string;
  html: string;
  pdfOptions?: OutputPdfOptions;
  title: string;
}

export interface OutputPdfOptions {
  landscape: boolean;
  marginType: "custom" | "none";
  margins: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  pageSize: "A3" | "A4" | "Legal" | "Letter";
  scaleFactor: number;
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

export interface OutputCopyResult {
  status: "copied";
}
