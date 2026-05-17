import { fixedStatusValues } from "../shared/status";

export interface EditorContextMenuState {
  selectionFrom: number;
  selectionText: string;
  selectionTo: number;
  x: number;
  y: number;
}

interface EditorContextMenuViewport {
  innerHeight: number;
  innerWidth: number;
}

export function editorContextMenuPosition(
  x: number,
  y: number,
  viewport: EditorContextMenuViewport = window
): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const estimatedHeight = 180;
  const maxX = Math.max(margin, viewport.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, viewport.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

export function frontmatterDialogCandidatesFor(
  key: string,
  candidates: Record<string, string[]>
): string[] {
  if (key === "status") return [...fixedStatusValues];

  return candidates[key] ?? [];
}
