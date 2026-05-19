export const GRAPH_WIDTH = 1600;
export const GRAPH_HEIGHT = 900;
export const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
export const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;
export const GRAPH_PADDING = 48;
export const GRAPH_MIN_ZOOM = 0.7;
export const GRAPH_MAX_ZOOM = 28;
export const GRAPH_WORKER_SIMULATION_NODE_THRESHOLD = 120;
export const GRAPH_SIMULATION_THROTTLE_NODE_THRESHOLD = 220;
export const GRAPH_SIMULATION_THROTTLE_FRAME_INTERVAL = 2;
export const GRAPH_VISIBLE_LABEL_NODE_LIMIT = 180;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
