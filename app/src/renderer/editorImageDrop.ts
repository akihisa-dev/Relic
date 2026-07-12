import { relicClient } from "./relicClient";
import type { EditorView } from "@codemirror/view";

import { isSupportedMarkdownImagePath, markdownImageAltFromPath } from "../shared/imageFiles";

export function droppedImageSourcePaths(event: DragEvent, getDroppedFilePath: (file: File) => string): string[] {
  const paths: string[] = [];

  for (const file of Array.from(event.dataTransfer?.files ?? [])) {
    const filePath = getDroppedFilePath(file);
    if (filePath && isSupportedMarkdownImagePath(filePath)) {
      paths.push(filePath);
    }
  }

  return paths;
}

export async function importDroppedImagesAsMarkdown(
  view: EditorView,
  event: DragEvent,
  filePath: string,
  sourcePaths: string[]
): Promise<void> {
  if (!relicClient.current || sourcePaths.length === 0) return;

  const destinationFolder = workspaceFolderForMarkdownFile(filePath);
  const snippets: string[] = [];

  for (const sourcePath of sourcePaths) {
    const importedImage = await relicClient.current.importImageFile({ destinationFolder, sourcePath });
    if (!importedImage.ok) continue;

    snippets.push(`![${markdownImageAltFromPath(importedImage.value.path)}](${importedImage.value.path})`);
  }

  if (snippets.length === 0) return;

  insertMarkdownImageBlock(view, dropPosition(view, event), snippets.join("\n"));
}

export function insertMarkdownImageBlock(view: EditorView, position: number, markdown: string): void {
  const doc = view.state.doc;
  const safePosition = Math.max(0, Math.min(position, doc.length));
  const before = safePosition > 0 ? doc.sliceString(safePosition - 1, safePosition) : "";
  const after = safePosition < doc.length ? doc.sliceString(safePosition, safePosition + 1) : "";
  const prefix = before && before !== "\n" ? "\n" : "";
  const suffix = after && after !== "\n" ? "\n" : "";

  view.dispatch({
    changes: { from: safePosition, insert: `${prefix}${markdown}${suffix}` },
    selection: { anchor: safePosition + prefix.length + markdown.length + suffix.length },
    scrollIntoView: true
  });
  view.focus();
}

export function workspaceFolderForMarkdownFile(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const separatorIndex = normalized.lastIndexOf("/");

  return separatorIndex <= 0 ? "" : normalized.slice(0, separatorIndex);
}

function dropPosition(view: EditorView, event: DragEvent): number {
  return view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.from;
}
