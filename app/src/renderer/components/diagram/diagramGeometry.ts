import {
  type RelicDiagramLine,
  type RelicDiagramNode,
  type RelicRelationshipDiagramDocument
} from "../../../shared/diagramMarkdown";

const canvasPadding = 180;
const minCanvasWidth = 900;
const minCanvasHeight = 620;
const lineAvoidanceMargin = 28;
const pairedLineGap = 24;
const turnCost = 8;
const reservedSegmentPenalty = 5000;
const portLeadDistance = 28;

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

interface DiagramPoint {
  x: number;
  y: number;
}

interface DiagramRect {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface RoutedSegment {
  end: DiagramPoint;
  start: DiagramPoint;
}

type RouteDirection = "h" | "none" | "v";
type NodePortSide = "bottom" | "left" | "right" | "top";

interface NodePort {
  point: DiagramPoint;
  side: NodePortSide;
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
  const reservedSegments: RoutedSegment[] = [];

  return lines.flatMap((line) => {
    const from = nodeById.get(line.from);
    const to = nodeById.get(line.to);
    if (!from || !to) return [];

    const pairKey = linePairKey(line.from, line.to);
    const pairCount = pairCounts.get(pairKey) ?? 1;
    const pairIndex = pairIndexes.get(pairKey) ?? 0;
    pairIndexes.set(pairKey, pairIndex + 1);
    const ports = relationshipLinePorts(from, to, pairCount > 1 ? pairIndex : null);
    const route = buildRoutedLineRoute(ports.start, ports.end, nodes, from.node.id, to.node.id, reservedSegments);
    reservedSegments.push(...segmentsFromPoints(route.points));

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

function relationshipLinePorts(
  from: DiagramCanvasNodeLayout,
  to: DiagramCanvasNodeLayout,
  pairIndex: number | null
): { end: NodePort; start: NodePort } {
  const fromCenter = nodeCenter(from);
  const toCenter = nodeCenter(to);
  const fromRect = nodeRect(from);
  const toRect = nodeRect(to);
  const horizontalGap = Math.max(toRect.left - fromRect.right, fromRect.left - toRect.right, 0);
  const verticalGap = Math.max(toRect.top - fromRect.bottom, fromRect.top - toRect.bottom, 0);
  const horizontal = horizontalGap >= verticalGap;
  const offset = pairIndex === null ? 0 : pairIndex === 0 ? -pairedLineGap / 2 : pairedLineGap / 2;

  if (horizontal) {
    const fromIsLeft = fromCenter.x <= toCenter.x;
    return {
      end: {
        point: {
          x: fromIsLeft ? to.x : to.x + to.node.width,
          y: clamp(toCenter.y + offset, to.y, to.y + to.node.height)
        },
        side: fromIsLeft ? "left" : "right"
      },
      start: {
        point: {
          x: fromIsLeft ? from.x + from.node.width : from.x,
          y: clamp(fromCenter.y + offset, from.y, from.y + from.node.height)
        },
        side: fromIsLeft ? "right" : "left"
      }
    };
  }

  const fromIsAbove = fromCenter.y <= toCenter.y;
  return {
    end: {
      point: {
        x: clamp(toCenter.x + offset, to.x, to.x + to.node.width),
        y: fromIsAbove ? to.y : to.y + to.node.height
      },
      side: fromIsAbove ? "top" : "bottom"
    },
    start: {
      point: {
        x: clamp(fromCenter.x + offset, from.x, from.x + from.node.width),
        y: fromIsAbove ? from.y + from.node.height : from.y
      },
      side: fromIsAbove ? "bottom" : "top"
    }
  };
}

function buildRoutedLineRoute(
  start: NodePort,
  end: NodePort,
  nodes: DiagramCanvasNodeLayout[],
  fromNodeId: string,
  toNodeId: string,
  reservedSegments: RoutedSegment[]
): { end: DiagramPoint; labelX: number; labelY: number; pathD: string; points: DiagramPoint[]; start: DiagramPoint } {
  const obstacles = nodes
    .filter((node) => node.node.id !== fromNodeId && node.node.id !== toNodeId)
    .map((node) => expandedNodeRect(node, lineAvoidanceMargin));
  const leadPoints = portLeadPoints(start, end);
  const routedPoints = routeOrthogonalPath(leadPoints.start, leadPoints.end, nodes, obstacles, reservedSegments);
  const points = simplifyRoute([start.point, ...routedPoints, end.point]);
  const pathD = pathFromPoints(points);
  const labelPoint = labelPointFromRoute(points);

  return {
    end: end.point,
    labelX: labelPoint.x,
    labelY: labelPoint.y,
    pathD,
    points,
    start: start.point
  };
}

function portLeadPoints(start: NodePort, end: NodePort): { end: DiagramPoint; start: DiagramPoint } {
  const startDirection = portOutwardDirection(start.side);
  const endDirection = portOutwardDirection(end.side);
  const leadDistance = usablePortLeadDistance(start, end, startDirection, endDirection);

  return {
    end: {
      x: end.point.x + endDirection.x * leadDistance,
      y: end.point.y + endDirection.y * leadDistance
    },
    start: {
      x: start.point.x + startDirection.x * leadDistance,
      y: start.point.y + startDirection.y * leadDistance
    }
  };
}

function usablePortLeadDistance(
  start: NodePort,
  end: NodePort,
  startDirection: DiagramPoint,
  endDirection: DiagramPoint
): number {
  if (sameCoordinate(start.point.y, end.point.y) && startDirection.x !== 0 && endDirection.x !== 0) {
    const gap = Math.abs(end.point.x - start.point.x);
    return Math.min(portLeadDistance, Math.max(0, gap / 3));
  }
  if (sameCoordinate(start.point.x, end.point.x) && startDirection.y !== 0 && endDirection.y !== 0) {
    const gap = Math.abs(end.point.y - start.point.y);
    return Math.min(portLeadDistance, Math.max(0, gap / 3));
  }
  return portLeadDistance;
}

function routeOrthogonalPath(
  start: DiagramPoint,
  end: DiagramPoint,
  nodes: DiagramCanvasNodeLayout[],
  obstacles: DiagramRect[],
  reservedSegments: RoutedSegment[]
): DiagramPoint[] {
  if (sameCoordinate(start.x, end.x) || sameCoordinate(start.y, end.y)) {
    const direct = [start, end];
    if (!segmentBlocked(start, end, obstacles) && segmentReservedPenalty(start, end, reservedSegments) === 0) {
      return direct;
    }
  }

  const xs = candidateCoordinates("x", start, end, nodes);
  const ys = candidateCoordinates("y", start, end, nodes);
  const pointByKey = new Map<string, DiagramPoint>();
  xs.forEach((x) => {
    ys.forEach((y) => {
      const point = { x, y };
      if (pointKey(point) === pointKey(start) || pointKey(point) === pointKey(end) || !pointInsideAnyRect(point, obstacles)) {
        pointByKey.set(pointKey(point), point);
      }
    });
  });
  pointByKey.set(pointKey(start), start);
  pointByKey.set(pointKey(end), end);

  const route = shortestOrthogonalRoute(start, end, xs, ys, pointByKey, obstacles, reservedSegments);
  return route.length > 0 ? simplifyRoute(route) : simplifyRoute([start, { x: end.x, y: start.y }, end]);
}

function candidateCoordinates(
  axis: "x" | "y",
  start: DiagramPoint,
  end: DiagramPoint,
  nodes: DiagramCanvasNodeLayout[]
): number[] {
  const values = new Set<number>([
    axis === "x" ? start.x : start.y,
    axis === "x" ? end.x : end.y
  ]);

  nodes.forEach((node) => {
    const rect = expandedNodeRect(node, lineAvoidanceMargin);
    if (axis === "x") {
      values.add(rect.left);
      values.add(rect.right);
      values.add(node.x);
      values.add(node.x + node.node.width);
      values.add(node.x + node.node.width / 2);
    } else {
      values.add(rect.top);
      values.add(rect.bottom);
      values.add(node.y);
      values.add(node.y + node.node.height);
      values.add(node.y + node.node.height / 2);
    }
  });

  return [...values].sort((a, b) => a - b);
}

function shortestOrthogonalRoute(
  start: DiagramPoint,
  end: DiagramPoint,
  xs: number[],
  ys: number[],
  pointByKey: Map<string, DiagramPoint>,
  obstacles: DiagramRect[],
  reservedSegments: RoutedSegment[]
): DiagramPoint[] {
  const startKey = stateKey(start, "none");
  const endPointKey = pointKey(end);
  const open = new Set<string>([startKey]);
  const costByState = new Map<string, number>([[startKey, 0]]);
  const pointByState = new Map<string, DiagramPoint>([[startKey, start]]);
  const directionByState = new Map<string, RouteDirection>([[startKey, "none"]]);
  const previousByState = new Map<string, string>();

  while (open.size > 0) {
    const currentKey = bestOpenState(open, costByState, pointByState, end);
    if (!currentKey) break;
    open.delete(currentKey);

    const current = pointByState.get(currentKey);
    const currentDirection = directionByState.get(currentKey) ?? "none";
    if (!current) continue;
    if (pointKey(current) === endPointKey) {
      return routeFromPrevious(currentKey, pointByState, previousByState);
    }

    for (const neighbor of routeNeighbors(current, xs, ys, pointByKey, obstacles)) {
      const direction = sameCoordinate(current.y, neighbor.y) ? "h" : "v";
      const nextKey = stateKey(neighbor, direction);
      const segmentLength = Math.abs(neighbor.x - current.x) + Math.abs(neighbor.y - current.y);
      const changedDirection = currentDirection !== "none" && currentDirection !== direction;
      const nextCost = (costByState.get(currentKey) ?? 0) +
        segmentLength +
        (changedDirection ? turnCost : 0) +
        segmentReservedPenalty(current, neighbor, reservedSegments);

      if (nextCost >= (costByState.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;

      costByState.set(nextKey, nextCost);
      pointByState.set(nextKey, neighbor);
      directionByState.set(nextKey, direction);
      previousByState.set(nextKey, currentKey);
      open.add(nextKey);
    }
  }

  return [];
}

function bestOpenState(
  open: Set<string>,
  costByState: Map<string, number>,
  pointByState: Map<string, DiagramPoint>,
  end: DiagramPoint
): string | null {
  let bestKey: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  open.forEach((key) => {
    const point = pointByState.get(key);
    if (!point) return;
    const score = (costByState.get(key) ?? Number.POSITIVE_INFINITY) + Math.abs(point.x - end.x) + Math.abs(point.y - end.y);
    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  });

  return bestKey;
}

function routeNeighbors(
  point: DiagramPoint,
  xs: number[],
  ys: number[],
  pointByKey: Map<string, DiagramPoint>,
  obstacles: DiagramRect[]
): DiagramPoint[] {
  const neighbors: DiagramPoint[] = [];
  const xIndex = xs.findIndex((x) => sameCoordinate(x, point.x));
  const yIndex = ys.findIndex((y) => sameCoordinate(y, point.y));
  const candidateIndexes = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 }
  ];

  candidateIndexes.forEach(({ dx, dy }) => {
    const x = xs[xIndex + dx] ?? point.x;
    const y = ys[yIndex + dy] ?? point.y;
    if (sameCoordinate(x, point.x) && sameCoordinate(y, point.y)) return;
    const neighbor = pointByKey.get(pointKey({ x, y }));
    if (!neighbor || segmentBlocked(point, neighbor, obstacles)) return;
    neighbors.push(neighbor);
  });

  return neighbors;
}

function routeFromPrevious(
  endStateKey: string,
  pointByState: Map<string, DiagramPoint>,
  previousByState: Map<string, string>
): DiagramPoint[] {
  const points: DiagramPoint[] = [];
  let currentKey: string | undefined = endStateKey;

  while (currentKey) {
    const point = pointByState.get(currentKey);
    if (point) points.push(point);
    currentKey = previousByState.get(currentKey);
  }

  return points.reverse();
}

function simplifyRoute(points: DiagramPoint[]): DiagramPoint[] {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const previous = points[index - 1];
    const next = points[index + 1];
    if (!previous || !next) return true;
    return !(sameCoordinate(previous.x, point.x) && sameCoordinate(point.x, next.x)) &&
      !(sameCoordinate(previous.y, point.y) && sameCoordinate(point.y, next.y));
  });
}

function pathFromPoints(points: DiagramPoint[]): string {
  return points.map((point, index) => {
    if (index === 0) return `M ${formatPathNumber(point.x)} ${formatPathNumber(point.y)}`;
    return `L ${formatPathNumber(point.x)} ${formatPathNumber(point.y)}`;
  }).join(" ");
}

function labelPointFromRoute(points: DiagramPoint[]): DiagramPoint {
  const segments = segmentsFromPoints(points);
  let longest = segments[0];
  let longestLength = -1;

  segments.forEach((segment) => {
    const length = Math.abs(segment.end.x - segment.start.x) + Math.abs(segment.end.y - segment.start.y);
    if (length > longestLength) {
      longest = segment;
      longestLength = length;
    }
  });

  if (!longest) return points[0] ?? { x: 0, y: 0 };
  return {
    x: (longest.start.x + longest.end.x) / 2,
    y: (longest.start.y + longest.end.y) / 2
  };
}

function segmentsFromPoints(points: DiagramPoint[]): RoutedSegment[] {
  const segments: RoutedSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start && end) segments.push({ end, start });
  }
  return segments;
}

function segmentBlocked(start: DiagramPoint, end: DiagramPoint, obstacles: DiagramRect[]): boolean {
  return obstacles.some((rect) => segmentIntersectsRect(start, end, rect));
}

function segmentIntersectsRect(start: DiagramPoint, end: DiagramPoint, rect: DiagramRect): boolean {
  if (sameCoordinate(start.y, end.y)) {
    const y = start.y;
    if (y <= rect.top || y >= rect.bottom) return false;
    return rangesOverlap(start.x, end.x, rect.left, rect.right);
  }
  if (sameCoordinate(start.x, end.x)) {
    const x = start.x;
    if (x <= rect.left || x >= rect.right) return false;
    return rangesOverlap(start.y, end.y, rect.top, rect.bottom);
  }
  return false;
}

function segmentReservedPenalty(start: DiagramPoint, end: DiagramPoint, reservedSegments: RoutedSegment[]): number {
  return reservedSegments.some((segment) => segmentsOverlap(start, end, segment.start, segment.end))
    ? reservedSegmentPenalty
    : 0;
}

function segmentsOverlap(aStart: DiagramPoint, aEnd: DiagramPoint, bStart: DiagramPoint, bEnd: DiagramPoint): boolean {
  if (sameCoordinate(aStart.y, aEnd.y) && sameCoordinate(bStart.y, bEnd.y) && sameCoordinate(aStart.y, bStart.y)) {
    return rangesOverlap(aStart.x, aEnd.x, bStart.x, bEnd.x);
  }
  if (sameCoordinate(aStart.x, aEnd.x) && sameCoordinate(bStart.x, bEnd.x) && sameCoordinate(aStart.x, bStart.x)) {
    return rangesOverlap(aStart.y, aEnd.y, bStart.y, bEnd.y);
  }
  return false;
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const aMin = Math.min(a1, a2);
  const aMax = Math.max(a1, a2);
  const bMin = Math.min(b1, b2);
  const bMax = Math.max(b1, b2);
  return aMin < bMax && bMin < aMax;
}

function pointInsideAnyRect(point: DiagramPoint, rects: DiagramRect[]): boolean {
  return rects.some((rect) => point.x > rect.left && point.x < rect.right && point.y > rect.top && point.y < rect.bottom);
}

function expandedNodeRect(node: DiagramCanvasNodeLayout, margin: number): DiagramRect {
  const rect = nodeRect(node);
  return {
    bottom: rect.bottom + margin,
    left: rect.left - margin,
    right: rect.right + margin,
    top: rect.top - margin
  };
}

function nodeRect(node: DiagramCanvasNodeLayout): DiagramRect {
  return {
    bottom: node.y + node.node.height,
    left: node.x,
    right: node.x + node.node.width,
    top: node.y
  };
}

function portOutwardDirection(side: NodePortSide): DiagramPoint {
  switch (side) {
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "top":
      return { x: 0, y: -1 };
  }
}

function pointKey(point: DiagramPoint): string {
  return `${formatPathNumber(point.x)},${formatPathNumber(point.y)}`;
}

function stateKey(point: DiagramPoint, direction: RouteDirection): string {
  return `${pointKey(point)},${direction}`;
}

function sameCoordinate(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPathNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function nodeCenter(node: DiagramCanvasNodeLayout): DiagramPoint {
  return {
    x: node.x + node.node.width / 2,
    y: node.y + node.node.height / 2
  };
}

export function nodeFileName(filePath: string): string {
  const name = filePath.split("/").at(-1) ?? filePath;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}
