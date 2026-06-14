export interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

const minZoom = 0.35;
const maxZoom = 2.5;

export function screenToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewport: ViewportState
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.panX) / viewport.zoom,
    y: (clientY - rect.top - viewport.panY) / viewport.zoom
  };
}

export function clampZoom(value: number): number {
  return Math.min(maxZoom, Math.max(minZoom, value));
}
