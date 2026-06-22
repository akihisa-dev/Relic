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
  const offsetX = x >= margin ? 28 : 0;
  const offsetY = y >= margin ? 18 : 0;
  const estimatedWidth = Math.min(340, Math.max(0, viewport.innerWidth - margin * 2));
  const estimatedHeight = Math.min(620, Math.max(0, Math.floor(viewport.innerHeight * 0.78)));
  const maxX = Math.max(margin, viewport.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, viewport.innerHeight - estimatedHeight - margin);
  const menuX = x + offsetX;
  const menuY = y + offsetY;

  return {
    x: Math.min(Math.max(margin, menuX), maxX),
    y: Math.min(Math.max(margin, menuY), maxY)
  };
}

export function frontmatterDialogCandidatesFor(
  key: string,
  candidates: Record<string, string[]>
): string[] {
  return candidates[key] ?? [];
}
