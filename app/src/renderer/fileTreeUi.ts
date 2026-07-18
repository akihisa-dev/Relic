interface ContextMenuPositionOptions {
  estimatedHeight?: number;
  estimatedWidth?: number;
}

export function contextMenuPosition(
  x: number,
  y: number,
  { estimatedHeight = 460, estimatedWidth = 220 }: ContextMenuPositionOptions = {}
): { x: number; y: number } {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}
