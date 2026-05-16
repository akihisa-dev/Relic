import {
  GRAPH_CENTER_X,
  GRAPH_CENTER_Y,
  GRAPH_HEIGHT,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_WIDTH,
  clamp
} from "./graphLayoutConstants";
import type { GraphPan, GraphViewBox } from "./graphLayoutTypes";

export function buildGraphViewBox(zoom: number, pan: GraphPan): GraphViewBox {
  const safeZoom = clamp(zoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
  const width = GRAPH_WIDTH / safeZoom;
  const height = GRAPH_HEIGHT / safeZoom;

  return {
    height,
    width,
    x: GRAPH_CENTER_X - (width / 2) + pan.x,
    y: GRAPH_CENTER_Y - (height / 2) + pan.y
  };
}
