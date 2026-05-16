export const GRAPH_WIDTH = 720;
export const GRAPH_HEIGHT = 520;
export const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
export const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;
export const GRAPH_PADDING = 28;
export const GRAPH_MIN_ZOOM = 0.7;
export const GRAPH_MAX_ZOOM = 1.8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
