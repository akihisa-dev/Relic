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
  line: 0xb9bdc0,
  lineFocused: 0x7e858a,
  node: 0x6f7478,
  nodeFocused: 0x4f565c,
  nodeSelected: 0x476a79,
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
  const nodeFocused = palette.nodeFocused;
  const nodeRelated = mixColor(palette.nodeFocused, palette.node, 0.74);
  const nodeSelected = palette.nodeSelected;
  const edgeColor = palette.line;
  const edgeSelected = palette.lineFocused;
  const dimmedEdgeAlpha = isLargeGraph ? 0.075 : 0.1;
  const normalEdgeAlpha = isLargeGraph ? 0.16 : 0.22;
  const focusedEdgeAlpha = isLargeGraph ? 0.42 : 0.5;

  return {
    edges: edges.flatMap((edge) => {
      const source = pointByPath.get(edge.sourcePath);
      const target = pointByPath.get(edge.targetPath);
      if (!source || !target) return [];

      const isFocused = focusedPath === edge.sourcePath || focusedPath === edge.targetPath;
      const isMotion = motionPath === edge.sourcePath || motionPath === edge.targetPath;
      return [{
        alpha: focusedPath && !isFocused ? dimmedEdgeAlpha : isFocused ? focusedEdgeAlpha : normalEdgeAlpha,
        color: isFocused ? edgeSelected : edgeColor,
        isFocused,
        isMotion,
        sourcePath: edge.sourcePath,
        strokeWidth: Math.min(
          isFocused ? 1.25 : 0.82,
          Math.max(isFocused ? 0.62 : 0.42, (isFocused ? 0.92 : isLargeGraph ? 0.5 : 0.62) * linkThickness)
        ) * inverseScale,
        targetPath: edge.targetPath,
        x1: source.x,
        x2: target.x,
        y1: source.y,
        y2: target.y
      }];
    }),
    isLargeGraph,
    nodes: points.map((point) => {
      const isSelected = point.path === selectedPath;
      const isRelated = relatedPaths.has(point.path);
      const isFocused = point.path === focusedPath;
      const isMotion = point.path === motionPath;
      const group = groupByPath.get(point.path);
      const isDimmed = !!focusedPath && !isRelated;
      const radiusBase = isLargeGraph ? 1.05 : 1.75;
      const radiusDegreeScale = isLargeGraph ? 0.42 : 0.78;
      const radiusMax = isLargeGraph ? 3.25 : 5.8;
      const screenRadius = Math.min(radiusMax, radiusBase + Math.sqrt(point.degree) * radiusDegreeScale) * nodeSize;
      const radius = screenRadius * inverseScale;
      const labelVisible = showLabels && (
        points.length <= GRAPH_VISIBLE_LABEL_NODE_LIMIT ||
        isSelected ||
        isFocused ||
        (!!focusedPath && isRelated)
      );
      const velocity = point as Partial<Pick<GraphRenderPoint, "vx" | "vy">>;
      const fillColor = group
        ? parseGraphColor(group.color, nodeFill)
        : isSelected
          ? nodeSelected
          : isFocused
            ? nodeFocused
            : isRelated && focusedPath
              ? nodeRelated
              : nodeFill;

      return {
        degree: point.degree,
        fillAlpha: isDimmed ? 0.26 : isSelected ? 0.94 : isFocused ? 0.9 : isRelated && focusedPath ? 0.78 : isLargeGraph ? 0.76 : 0.82,
        fillColor,
        folder: point.folder,
        incoming: point.incoming,
        isDimmed,
        isFocused,
        isMotion,
        isRelated,
        isSelected,
        labelAlpha: isDimmed ? Math.min(0.24, labelOpacity) : isLargeGraph ? Math.min(0.82, labelOpacity) : labelOpacity,
        labelVisible,
        name: point.name,
        path: point.path,
        radius,
        ringVisible: isSelected,
        outgoing: point.outgoing,
        strokeAlpha: isSelected ? 0.56 : isFocused ? 0.34 : isLargeGraph ? 0.08 : 0.16,
        strokeColor: isSelected ? mixColor(nodeSelected, palette.background, 0.72) : palette.background,
        strokeWidth: (isSelected ? 0.96 : isFocused ? 0.68 : isLargeGraph ? 0.28 : 0.48) * inverseScale,
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

function mixColor(first: number, second: number, firstWeight: number): number {
  const secondWeight = 1 - firstWeight;
  const firstRgb = numberToRgb(first);
  const secondRgb = numberToRgb(second);
  return rgbToNumber(
    Math.round(firstRgb.r * firstWeight + secondRgb.r * secondWeight),
    Math.round(firstRgb.g * firstWeight + secondRgb.g * secondWeight),
    Math.round(firstRgb.b * firstWeight + secondRgb.b * secondWeight)
  );
}

function numberToRgb(value: number): { b: number; g: number; r: number } {
  return {
    b: value & 0xff,
    g: (value >> 8) & 0xff,
    r: (value >> 16) & 0xff
  };
}

function rgbToNumber(r: number, g: number, b: number): number {
  return ((clampChannel(r) << 16) | (clampChannel(g) << 8) | clampChannel(b)) >>> 0;
}

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}
