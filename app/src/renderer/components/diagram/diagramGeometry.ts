import {
  type RelicDiagramLine,
  type RelicDiagramNode,
  type RelicRelationshipDiagramDocument
} from "../../../shared/diagramMarkdown";

const canvasPadding = 180;
const minCanvasWidth = 900;
const minCanvasHeight = 620;
const singleLineCurveOffset = 36;
const pairedLineCurveOffset = 58;

export interface DiagramCanvasLayout {
  height: number;
  lines: DiagramCanvasLineLayout[];
  nodes: DiagramCanvasNodeLayout[];
  originX: number;
  originY: number;
  width: number;
}

export interface DiagramCanvasNodeLayout {
  node: RelicDiagramNode;
  x: number;
  y: number;
}

export interface DiagramCanvasLineLayout {
  label: string;
  line: RelicDiagramLine;
  labelX: number;
  labelY: number;
  pathD: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export function buildDiagramCanvasLayout(diagram: RelicRelationshipDiagramDocument): DiagramCanvasLayout {
  if (diagram.nodes.length === 0) {
    return {
      height: minCanvasHeight,
      lines: [],
      nodes: [],
      originX: 0,
      originY: 0,
      width: minCanvasWidth
    };
  }

  const minX = Math.min(...diagram.nodes.map((node) => node.x));
  const minY = Math.min(...diagram.nodes.map((node) => node.y));
  const maxX = Math.max(...diagram.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...diagram.nodes.map((node) => node.y + node.height));
  const originX = minX - canvasPadding;
  const originY = minY - canvasPadding;
  const nodes = diagram.nodes.map((node) => ({
    node,
    x: node.x - originX,
    y: node.y - originY
  }));

  return {
    height: Math.max(minCanvasHeight, maxY - minY + canvasPadding * 2),
    lines: buildLineLayouts(diagram.lines, nodes),
    nodes,
    originX,
    originY,
    width: Math.max(minCanvasWidth, maxX - minX + canvasPadding * 2)
  };
}

export function buildLineLayouts(
  lines: RelicDiagramLine[],
  nodes: DiagramCanvasNodeLayout[]
): DiagramCanvasLineLayout[] {
  const nodeById = new Map(nodes.map((node) => [node.node.id, node]));
  const pairCounts = countLinePairs(lines);

  return lines.flatMap((line) => {
    const from = nodeById.get(line.from);
    const to = nodeById.get(line.to);
    if (!from || !to) return [];

    const fromCenter = nodeCenter(from);
    const toCenter = nodeCenter(to);
    const pairKey = linePairKey(line.from, line.to);
    const curveOffset = (pairCounts.get(pairKey) ?? 1) > 1
      ? pairedLineCurveOffset
      : singleLineCurveOffset;
    const route = buildCurvedLineRoute(
      nodeEdgePointToward(from, toCenter.x, toCenter.y),
      nodeEdgePointToward(to, fromCenter.x, fromCenter.y),
      curveOffset
    );

    return [{
      label: line.label,
      labelX: route.labelX,
      labelY: route.labelY,
      line,
      pathD: route.pathD,
      x1: route.start.x,
      x2: route.end.x,
      y1: route.start.y,
      y2: route.end.y
    }];
  });
}

function countLinePairs(lines: RelicDiagramLine[]): Map<string, number> {
  const counts = new Map<string, number>();
  lines.forEach((line) => {
    const key = linePairKey(line.from, line.to);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
}

function linePairKey(from: string, to: string): string {
  return from < to ? `${from}\u0000${to}` : `${to}\u0000${from}`;
}

function buildCurvedLineRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  curveOffset: number
): { end: { x: number; y: number }; labelX: number; labelY: number; pathD: string; start: { x: number; y: number } } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    const pathD = `M ${formatPathNumber(start.x)} ${formatPathNumber(start.y)} L ${formatPathNumber(end.x)} ${formatPathNumber(end.y)}`;
    return {
      end,
      labelX: start.x,
      labelY: start.y,
      pathD,
      start
    };
  }

  const control = {
    x: (start.x + end.x) / 2 + (-dy / length) * curveOffset,
    y: (start.y + end.y) / 2 + (dx / length) * curveOffset
  };
  const label = quadraticBezierPoint(start, control, end, 0.5);

  return {
    end,
    labelX: label.x,
    labelY: label.y,
    pathD: `M ${formatPathNumber(start.x)} ${formatPathNumber(start.y)} Q ${formatPathNumber(control.x)} ${formatPathNumber(control.y)} ${formatPathNumber(end.x)} ${formatPathNumber(end.y)}`,
    start
  };
}

function quadraticBezierPoint(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y
  };
}

function formatPathNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function nodeCenter(node: DiagramCanvasNodeLayout): { x: number; y: number } {
  return {
    x: node.x + node.node.width / 2,
    y: node.y + node.node.height / 2
  };
}

function nodeEdgePointToward(
  node: DiagramCanvasNodeLayout,
  targetX: number,
  targetY: number
): { x: number; y: number } {
  const center = nodeCenter(node);
  const dx = targetX - center.x;
  const dy = targetY - center.y;
  if (dx === 0 && dy === 0) return center;

  const halfWidth = node.node.width / 2;
  const halfHeight = node.node.height / 2;
  const scaleX = dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

export function nodeFileName(filePath: string): string {
  const name = filePath.split("/").at(-1) ?? filePath;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}
