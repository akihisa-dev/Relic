import type { RelicResult } from "../result";
import type { IpcFeatureContract } from "./contract";

export const savePreviewAsPdfChannel = "output:savePreviewAsPdf";
export const saveDiagramSvgChannel = "output:saveDiagramSvg";
export const copyDiagramSvgChannel = "output:copyDiagramSvg";
export const previewOutputHtmlMaxBytes = 2 * 1024 * 1024;
export const maxSvgInputBytes = 2 * 1024 * 1024;

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

export interface OutputApi {
  copyDiagramSvg: (input: CopyDiagramSvgInput) => Promise<RelicResult<OutputCopyResult>>;
  saveDiagramSvg: (input: SaveDiagramSvgInput) => Promise<RelicResult<OutputSavedResult>>;
  savePreviewAsPdf: (input: SavePreviewAsPdfInput) => Promise<RelicResult<OutputSavedResult>>;
}

export const outputIpcContract = {
  copyDiagramSvg: { channel: copyDiagramSvgChannel, main: "handle", transport: "invoke", validatesInput: true },
  saveDiagramSvg: { channel: saveDiagramSvgChannel, main: "handle", transport: "invoke", validatesInput: true },
  savePreviewAsPdf: { channel: savePreviewAsPdfChannel, main: "handle", transport: "invoke", validatesInput: true }
} as const satisfies IpcFeatureContract;
