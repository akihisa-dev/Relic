import type { WorkspaceGraphEdge } from "../shared/ipc";
import { GRAPH_VISIBLE_LABEL_NODE_LIMIT, type GraphPoint } from "./graphLayout";
import type { GraphGroup } from "./store/graphStore";

export interface GraphRenderPalette {
  accent: number;
  background: number;
  line: number;
  lineFocused: number;
  node: number;
  nodeFocused: number;
  nodeSelected: number;
  text: number;
}

export interface GraphRenderPoint {
  degree: number;
  folder: string;
  incoming: number;
  name: string;
  outgoing: number;
  path: string;
  tags: string[];
  vx?: number;
  vy?: number;
  x: number;
  y: number;
}

export interface GraphRenderNode extends GraphRenderPoint {
  fillAlpha: number;
  fillColor: number;
  isDimmed: boolean;
  isFocused: boolean;
  isMotion: boolean;
  isRelated: boolean;
  isSelected: boolean;
  labelAlpha: number;
  labelVisible: boolean;
  radius: number;
  ringVisible: boolean;
  strokeAlpha: number;
  strokeColor: number;
  strokeWidth: number;
}

export interface GraphRenderEdge {
  alpha: number;
  color: number;
  isFocused: boolean;
  isMotion: boolean;
  sourcePath: string;
  strokeWidth: number;
  targetPath: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface GraphRenderState {
  edges: GraphRenderEdge[];
  isLargeGraph: boolean;
  nodes: GraphRenderNode[];
  palette: GraphRenderPalette;
}

export const defaultGraphRenderPalette: GraphRenderPalette = {
  accent: 0x00628c,
  background: 0xffffff,
  line: 0xc4c5c7,
  lineFocused: 0xb9b7c4,
  node: 0x5a5b5d,
  nodeFocused: 0x555658,
  nodeSelected: 0x555658,
  text: 0x1c1c1c
};

export function buildGraphRenderState({
  edges,
  focusedPath,
  groupByPath,
  labelOpacity,
  linkThickness,
  motionPath,
  nodeSize,
  palette = defaultGraphRenderPalette,
  points,
  relatedPaths,
  selectedPath,
  showLabels,
  viewScale = 1
}: {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  groupByPath: Map<string, GraphGroup>;
  labelOpacity: number;
  linkThickness: number;
  motionPath: string | null;
  nodeSize: number;
  palette?: GraphRenderPalette;
  points: GraphPoint[];
  relatedPaths: Set<string>;
  selectedPath: string | null;
  showLabels: boolean;
  viewScale?: number;
}): GraphRenderState {
  const pointByPath = new Map(points.map((point) => [point.path, point]));
  const isLargeGraph = points.length > 220 || edges.length > 520;
  const screenScale = clampViewScale(viewScale);
  const inverseScale = 1 / screenScale;
  const nodeFill = palette.node;
  const edgeColor = palette.line;
  const edgeLod = graphRenderLod(screenScale);
  const normalEdgeAlpha = isLargeGraph ? 0.18 + edgeLod * 0.16 : 0.32;
  const baseEdgeScreenWidth = isLargeGraph ? 0.42 + edgeLod * 0.26 : 0.78;
  const visibleLabelPaths = buildVisibleLabelPaths({
    isLargeGraph,
    points,
    screenScale,
    showLabels
  });

  return {
    edges: edges.flatMap((edge) => {
      const source = pointByPath.get(edge.sourcePath);
      const target = pointByPath.get(edge.targetPath);
      if (!source || !target) return [];

      return [{
        alpha: normalEdgeAlpha,
        color: edgeColor,
        isFocused: false,
        isMotion: false,
        sourcePath: edge.sourcePath,
        strokeWidth: baseEdgeScreenWidth * linkThickness * inverseScale,
        targetPath: edge.targetPath,
        x1: source.x,
        x2: target.x,
        y1: source.y,
        y2: target.y
      }];
    }),
    isLargeGraph,
    nodes: points.map((point) => {
      const isSelected = false;
      const group = groupByPath.get(point.path);
      const isDimmed = false;
      const screenRadius = graphNodeScreenRadius({ isLargeGraph, nodeSize, screenScale });
      const radius = screenRadius * inverseScale;
      const labelVisible = visibleLabelPaths.has(point.path);
      const velocity = point as Partial<Pick<GraphRenderPoint, "vx" | "vy">>;
      let fillColor = nodeFill;
      if (group) {
        fillColor = parseGraphColor(group.color, nodeFill);
      }

      return {
        degree: point.degree,
        fillAlpha: isLargeGraph ? 0.82 + edgeLod * 0.14 : 0.96,
        fillColor,
        folder: point.folder,
        incoming: point.incoming,
        isDimmed,
        isFocused: false,
        isMotion: false,
        isRelated: false,
        isSelected,
        labelAlpha: isLargeGraph ? Math.min(0.72, labelOpacity) : labelOpacity,
        labelVisible,
        name: point.name,
        path: point.path,
        radius,
        ringVisible: false,
        outgoing: point.outgoing,
        strokeAlpha: 0,
        strokeColor: palette.background,
        strokeWidth: 0,
        tags: point.tags,
        vx: velocity.vx,
        vy: velocity.vy,
        x: point.x,
        y: point.y
      };
    }),
    palette
  };
}

function buildVisibleLabelPaths({
  isLargeGraph,
  points,
  screenScale,
  showLabels
}: {
  isLargeGraph: boolean;
  points: GraphPoint[];
  screenScale: number;
  showLabels: boolean;
}): Set<string> {
  if (!showLabels) return new Set<string>();
  if (!isLargeGraph && points.length <= GRAPH_VISIBLE_LABEL_NODE_LIMIT) {
    return new Set(points.map((point) => point.path));
  }
  if (screenScale < 2.6) return new Set<string>();

  const fontSize = graphLabelScreenFontSize(screenScale);
  const screenRadius = graphNodeScreenRadius({ isLargeGraph, nodeSize: 1, screenScale });
  const occupied: Array<{ bottom: number; left: number; right: number; top: number }> = [];
  const visible = new Set<string>();
  const candidates = [...points].sort((a, b) => {
    const degreeDiff = b.degree - a.degree;
    return degreeDiff || a.path.localeCompare(b.path, "ja");
  });

  for (const point of candidates) {
    const width = Math.max(24, point.name.length * fontSize * 0.58);
    const height = fontSize * 1.18;
    const centerX = point.x * screenScale;
    const top = point.y * screenScale + screenRadius + 2;
    const rect = {
      bottom: top + height + 10,
      left: centerX - width / 2 - 10,
      right: centerX + width / 2 + 10,
      top: top - 6
    };

    if (occupied.some((current) => rectanglesOverlap(rect, current))) continue;
    occupied.push(rect);
    visible.add(point.path);
  }

  return visible;
}

function rectanglesOverlap(
  first: { bottom: number; left: number; right: number; top: number },
  second: { bottom: number; left: number; right: number; top: number }
): boolean {
  return first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top;
}

function graphLabelScreenFontSize(viewScale: number): number {
  const safeScale = Math.max(0.001, viewScale);
  return Math.min(13, Math.max(4.5, 5 * Math.pow(safeScale, 0.8)));
}

function graphNodeScreenRadius({
  isLargeGraph,
  nodeSize,
  screenScale
}: {
  isLargeGraph: boolean;
  nodeSize: number;
  screenScale: number;
}): number {
  const zoomNodeScale = Math.min(2.2, Math.max(0.82, Math.sqrt(screenScale)));
  const baseRadius = isLargeGraph ? 2.25 : 3.1;
  const largeGraphDensityScale = isLargeGraph ? 0.78 + graphRenderLod(screenScale) * 0.22 : 1;
  return Math.min(7.2, Math.max(1.8, baseRadius * nodeSize * zoomNodeScale * largeGraphDensityScale));
}

function graphRenderLod(screenScale: number): number {
  return Math.min(1, Math.max(0, (screenScale - 0.55) / 3.2));
}

function clampViewScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(12, Math.max(0.08, value));
}

export function parseGraphColor(value: string, fallback: number): number {
  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return Number.parseInt(normalized.slice(1), 16);
  }
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [r, g, b] = normalized.slice(1).split("");
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }
  const rgb = normalized.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb) {
    return rgbToNumber(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }
  return fallback;
}

export function readGraphPalette(element: HTMLElement | null): GraphRenderPalette {
  if (!element || typeof window === "undefined") return defaultGraphRenderPalette;

  const styles = window.getComputedStyle(element);
  return {
    accent: parseGraphColor(styles.getPropertyValue("--accent"), defaultGraphRenderPalette.accent),
    background: parseGraphColor(styles.getPropertyValue("--bg"), defaultGraphRenderPalette.background),
    line: parseGraphColor(styles.getPropertyValue("--graph-line"), defaultGraphRenderPalette.line),
    lineFocused: parseGraphColor(styles.getPropertyValue("--graph-line-focused"), defaultGraphRenderPalette.lineFocused),
    node: parseGraphColor(styles.getPropertyValue("--graph-node"), defaultGraphRenderPalette.node),
    nodeFocused: parseGraphColor(styles.getPropertyValue("--graph-node-focused"), defaultGraphRenderPalette.nodeFocused),
    nodeSelected: parseGraphColor(styles.getPropertyValue("--graph-node-selected"), defaultGraphRenderPalette.nodeSelected),
    text: parseGraphColor(styles.getPropertyValue("--text"), defaultGraphRenderPalette.text)
  };
}

function rgbToNumber(r: number, g: number, b: number): number {
  return ((clampChannel(r) << 16) | (clampChannel(g) << 8) | clampChannel(b)) >>> 0;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}
