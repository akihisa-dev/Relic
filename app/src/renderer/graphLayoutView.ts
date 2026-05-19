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
import type { GraphPoint } from "./graphLayoutTypes";

const graphFitPaddingMin = 64;
const graphFitPaddingMax = 168;
const graphFitMinWidth = 520;
const graphFitMinHeight = 360;
const graphFitAspectRatio = GRAPH_WIDTH / GRAPH_HEIGHT;

export function buildGraphViewBox(zoom: number, pan: GraphPan, points: GraphPoint[] = []): GraphViewBox {
  const safeZoom = clamp(zoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
  const fit = buildGraphFitViewBox(points);
  const width = fit.width / safeZoom;
  const height = fit.height / safeZoom;

  return {
    height,
    width,
    x: fit.x + (fit.width - width) / 2 + pan.x,
    y: fit.y + (fit.height - height) / 2 + pan.y
  };
}

export function buildGraphFitViewBox(points: GraphPoint[]): GraphViewBox {
  if (points.length === 0) {
    return {
      height: GRAPH_HEIGHT,
      width: GRAPH_WIDTH,
      x: GRAPH_CENTER_X - GRAPH_WIDTH / 2,
      y: GRAPH_CENTER_Y - GRAPH_HEIGHT / 2
    };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return buildGraphFitViewBox([]);
  }

  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);
  const boundsMax = Math.max(boundsWidth, boundsHeight);
  const padding = clamp(boundsMax * 0.1, graphFitPaddingMin, graphFitPaddingMax);
  let width = Math.max(graphFitMinWidth, boundsWidth + padding * 2);
  let height = Math.max(graphFitMinHeight, boundsHeight + padding * 2);

  if (width / height > graphFitAspectRatio) {
    height = width / graphFitAspectRatio;
  } else {
    width = height * graphFitAspectRatio;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    height,
    width,
    x: centerX - width / 2,
    y: centerY - height / 2
  };
}
