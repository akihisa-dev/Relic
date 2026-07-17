import { isSupportedMarkdownImagePath } from "./imageFiles";
import { hasMarkdownExtension } from "./markdownExtension";
import { isSupportedPdfPath } from "./pdfFiles";
import type { WorkspaceTreeFileKind } from "./ipc/workspace";

export function workspaceFileKindForPath(path: string): WorkspaceTreeFileKind | null {
  if (hasMarkdownExtension(path)) return "markdown";
  if (isSupportedMarkdownImagePath(path)) return "image";
  if (isSupportedPdfPath(path)) return "pdf";
  return null;
}

export function isSupportedWorkspaceFilePath(path: string): boolean {
  return workspaceFileKindForPath(path) !== null;
}
