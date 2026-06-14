import {
  type RelicDiagramLine,
  type RelicDiagramNode,
  type RelicRelationshipDiagramDocument
} from "../../../shared/diagramMarkdown";

const canvasPadding = 180;
const lineLabelOffset = 8;
const minCanvasWidth = 900;
const minCanvasHeight = 620;
const parallelLineGap = 20;

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
  const pairIndexes = new Map<string, number>();

  return lines.flatMap((line) => {
    const from = nodeById.get(line.from);
    const to = nodeById.get(line.to);
    if (!from || !to) return [];

    const fromCenter = nodeCenter(from);
    const toCenter = nodeCenter(to);
    const pairKey = linePairKey(line.from, line.to);
    const pairIndex = pairIndexes.get(pairKey) ?? 0;
    pairIndexes.set(pairKey, pairIndex + 1);
    const offset = lineOffsetForPair(pairCounts.get(pairKey) ?? 1, pairIndex, line, nodeById);
    const start = offsetPoint(nodeEdgePointToward(from, toCenter.x, toCenter.y), offset);
    const end = offsetPoint(nodeEdgePointToward(to, fromCenter.x, fromCenter.y), offset);
    const route = buildLineRoute(start, end, to);

    return [{
      label: line.label,
      labelX: route.labelX,
      labelY: route.labelY,
      line,
      pathD: route.pathD,
      x1: start.x,
      x2: end.x,
      y1: start.y,
      y2: end.y
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

function lineOffsetForPair(
  pairCount: number,
  pairIndex: number,
  line: RelicDiagramLine,
  nodeById: Map<string, DiagramCanvasNodeLayout>
): { x: number; y: number } {
  if (pairCount < 2) return { x: 0, y: 0 };

  const firstId = line.from < line.to ? line.from : line.to;
  const secondId = line.from < line.to ? line.to : line.from;
  const first = nodeById.get(firstId);
  const second = nodeById.get(secondId);
  if (!first || !second) return { x: 0, y: 0 };

  const firstCenter = nodeCenter(first);
  const secondCenter = nodeCenter(second);
  const dx = secondCenter.x - firstCenter.x;
  const dy = secondCenter.y - firstCenter.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return { x: 0, y: 0 };

  const distance = (pairIndex - (pairCount - 1) / 2) * parallelLineGap;
  return {
    x: (-dy / length) * distance,
    y: (dx / length) * distance
  };
}

function offsetPoint(point: { x: number; y: number }, offset: { x: number; y: number }): { x: number; y: number } {
  return {
    x: point.x + offset.x,
    y: point.y + offset.y
  };
}

function buildLineRoute(
  start: { x: number; y: number },
  end: { x: number; y: number },
  to: DiagramCanvasNodeLayout
): { labelX: number; labelY: number; pathD: string } {
  if (sameCoordinate(start.x, end.x) || sameCoordinate(start.y, end.y)) {
    return buildRouteFromPoints([start, end]);
  }

  const toTop = to.y;
  const toBottom = to.y + to.node.height;
  const endsOnVerticalEdge = sameCoordinate(end.y, toTop) || sameCoordinate(end.y, toBottom);

  if (endsOnVerticalEdge) {
    const midY = (start.y + end.y) / 2;
    return buildRouteFromPoints([start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]);
  }

  const midX = (start.x + end.x) / 2;
  return buildRouteFromPoints([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
}

function buildRouteFromPoints(points: Array<{ x: number; y: number }>): { labelX: number; labelY: number; pathD: string } {
  const pathD = points.map((point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    if (previous && sameCoordinate(point.x, previous.x)) return `V ${point.y}`;
    if (previous && sameCoordinate(point.y, previous.y)) return `H ${point.x}`;
    return `L ${point.x} ${point.y}`;
  }).join(" ");
  const labelSegment = longestRouteSegment(points);
  const labelX = (labelSegment.start.x + labelSegment.end.x) / 2;
  const labelY = (labelSegment.start.y + labelSegment.end.y) / 2;

  return {
    labelX: sameCoordinate(labelSegment.start.x, labelSegment.end.x) ? labelX + lineLabelOffset : labelX,
    labelY: sameCoordinate(labelSegment.start.y, labelSegment.end.y) ? labelY - lineLabelOffset : labelY,
    pathD
  };
}

function longestRouteSegment(points: Array<{ x: number; y: number }>): {
  end: { x: number; y: number };
  start: { x: number; y: number };
} {
  let longest = {
    end: points[1] ?? points[0],
    length: 0,
    start: points[0]
  };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length > longest.length) {
      longest = {
        end,
        length,
        start
      };
    }
  }

  return {
    end: longest.end,
    start: longest.start
  };
}

function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
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
