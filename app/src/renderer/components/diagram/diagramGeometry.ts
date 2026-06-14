import {
  type RelicDiagramLine,
  type RelicDiagramNode,
  type RelicRelationshipDiagramDocument
} from "../../../shared/diagramMarkdown";

const canvasPadding = 180;
const minCanvasWidth = 900;
const minCanvasHeight = 620;

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

  return lines.flatMap((line) => {
    const from = nodeById.get(line.from);
    const to = nodeById.get(line.to);
    if (!from || !to) return [];

    const fromCenter = nodeCenter(from);
    const toCenter = nodeCenter(to);
    const start = nodeEdgePointToward(from, toCenter.x, toCenter.y);
    const end = nodeEdgePointToward(to, fromCenter.x, fromCenter.y);

    return [{
      label: line.label,
      labelX: (start.x + end.x) / 2,
      labelY: (start.y + end.y) / 2 - 8,
      line,
      pathD: buildLinePathD(start, end, to),
      x1: start.x,
      x2: end.x,
      y1: start.y,
      y2: end.y
    }];
  });
}

function buildLinePathD(
  start: { x: number; y: number },
  end: { x: number; y: number },
  to: DiagramCanvasNodeLayout
): string {
  if (sameCoordinate(start.x, end.x) || sameCoordinate(start.y, end.y)) {
    return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  }

  const toTop = to.y;
  const toBottom = to.y + to.node.height;
  const endsOnVerticalEdge = sameCoordinate(end.y, toTop) || sameCoordinate(end.y, toBottom);

  if (endsOnVerticalEdge) {
    const midY = (start.y + end.y) / 2;
    return `M ${start.x} ${start.y} V ${midY} H ${end.x} V ${end.y}`;
  }

  const midX = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} H ${midX} V ${end.y} H ${end.x}`;
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
