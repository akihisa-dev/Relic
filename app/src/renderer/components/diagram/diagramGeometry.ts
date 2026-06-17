import {
  type RelicConnectedDiagramDocument,
  type RelicConnectedDiagramNode,
  type RelicDiagramLine,
} from "../../../shared/diagramMarkdown";
import { stripMarkdownExtension } from "../../../shared/markdownExtension";
import { diagramLineDisplayLayer } from "./diagramLayering";

const canvasPadding = 192;
const minCanvasWidth = 900;
const minCanvasHeight = 620;
const lineAvoidanceMargin = 28;
const lineJumpOffset = 14;
const lineJumpRadius = 12;
const labelAvoidanceRadius = 56;
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
  node: RelicConnectedDiagramNode;
  x: number;
  y: number;
}

export interface DiagramCanvasLineLayout {
  displayLayer: number;
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
  label: string;
  start: DiagramPoint;
  toNodeId: string;
}

type RouteDirection = "h" | "none" | "v";
type NodePortSide = "bottom" | "left" | "right" | "top";

interface NodePort {
  point: DiagramPoint;
  side: NodePortSide;
}

interface LineRouteContext {
  end: NodePort;
  from: DiagramCanvasNodeLayout;
  line: RelicDiagramLine;
  start: NodePort;
  to: DiagramCanvasNodeLayout;
}

export function buildDiagramCanvasLayout(diagram: RelicConnectedDiagramDocument): DiagramCanvasLayout {
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
  const reservedSegments: RoutedSegment[] = [];
  const contexts = lines.flatMap((line): LineRouteContext[] => {
    const from = nodeById.get(line.from);
    const to = nodeById.get(line.to);
    if (!from || !to) return [];

    const ports = relationshipLinePorts(from, to);
    return [{
      end: ports.end,
      from,
      line,
      start: ports.start,
      to
    }];
  });

  applyDestinationPortLanes(contexts);

  const routedLines = contexts.map((context) => {
    const conflictingSegments = reservedSegments.filter((segment) => !canShareRoutedSegment(segment, context));
    const route = buildRoutedLineRoute(
      context.start,
      context.end,
      nodes,
      context.from.node.id,
      context.to.node.id,
      conflictingSegments
    );
    reservedSegments.push(...segmentsFromPoints(route.points, context.to.node.id, context.line.label));
    return { context, route };
  });

  return routedLines.map(({ context, route }, index) => {
    const otherSegments = routedLines.flatMap((routedLine, otherIndex) => (
      otherIndex === index ? [] : segmentsFromPoints(routedLine.route.points)
    ));
    const labelPoint = labelPointFromRoute(route.points, otherSegments);
    return {
      label: context.line.label,
      displayLayer: diagramLineDisplayLayer(context.from.node, context.to.node),
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      line: context.line,
      pathD: pathFromPointsWithVerticalLineJumps(route.points, otherSegments),
      x1: route.start.x,
      x2: route.end.x,
      y1: route.start.y,
      y2: route.end.y
    };
  });
}

function relationshipLinePorts(
  from: DiagramCanvasNodeLayout,
  to: DiagramCanvasNodeLayout
): { end: NodePort; start: NodePort } {
  const fromCenter = nodeCenter(from);
  const toCenter = nodeCenter(to);
  const fromRect = nodeRect(from);
  const toRect = nodeRect(to);
  const horizontalGap = Math.max(toRect.left - fromRect.right, fromRect.left - toRect.right, 0);
  const verticalGap = Math.max(toRect.top - fromRect.bottom, fromRect.top - toRect.bottom, 0);
  const horizontal = horizontalGap >= verticalGap;

  if (horizontal) {
    const fromIsLeft = fromCenter.x <= toCenter.x;
    return {
      end: {
        point: {
          x: fromIsLeft ? to.x : to.x + to.node.width,
          y: toCenter.y
        },
        side: fromIsLeft ? "left" : "right"
      },
      start: {
        point: {
          x: fromIsLeft ? from.x + from.node.width : from.x,
          y: fromCenter.y
        },
        side: fromIsLeft ? "right" : "left"
      }
    };
  }

  const fromIsAbove = fromCenter.y <= toCenter.y;
  return {
    end: {
      point: {
        x: toCenter.x,
        y: fromIsAbove ? to.y : to.y + to.node.height
      },
      side: fromIsAbove ? "top" : "bottom"
    },
    start: {
      point: {
        x: fromCenter.x,
        y: fromIsAbove ? from.y + from.node.height : from.y
      },
      side: fromIsAbove ? "bottom" : "top"
    }
  };
}

function applyDestinationPortLanes(contexts: LineRouteContext[]): void {
  const groups = new Map<string, Array<{ context: LineRouteContext; node: DiagramCanvasNodeLayout; port: NodePort }>>();

  contexts.forEach((context) => {
    addPortUsage(groups, context.from, context.start, context);
    addPortUsage(groups, context.to, context.end, context);
  });

  groups.forEach((usages) => {
    const destinationIds: string[] = [];
    usages.forEach(({ context }) => {
      if (!destinationIds.includes(context.to.node.id)) destinationIds.push(context.to.node.id);
    });
    if (destinationIds.length <= 1) return;

    const offsetByDestination = new Map(destinationIds.map((destinationId, index) => [
      destinationId,
      (index - (destinationIds.length - 1) / 2) * pairedLineGap
    ]));

    usages.forEach(({ context, node, port }) => {
      const offset = offsetByDestination.get(context.to.node.id) ?? 0;
      port.point = offsetPortPoint(port, node, offset);
    });
  });
}

function addPortUsage(
  groups: Map<string, Array<{ context: LineRouteContext; node: DiagramCanvasNodeLayout; port: NodePort }>>,
  node: DiagramCanvasNodeLayout,
  port: NodePort,
  context: LineRouteContext
): void {
  const key = `${node.node.id}\u0000${port.side}`;
  groups.set(key, [...(groups.get(key) ?? []), { context, node, port }]);
}

function offsetPortPoint(port: NodePort, node: DiagramCanvasNodeLayout, offset: number): DiagramPoint {
  const inset = Math.min(16, node.node.width / 2, node.node.height / 2);
  switch (port.side) {
    case "bottom":
    case "top":
      return {
        x: clamp(port.point.x + offset, node.x + inset, node.x + node.node.width - inset),
        y: port.point.y
      };
    case "left":
    case "right":
      return {
        x: port.point.x,
        y: clamp(port.point.y + offset, node.y + inset, node.y + node.node.height - inset)
      };
  }
}

function buildRoutedLineRoute(
  start: NodePort,
  end: NodePort,
  nodes: DiagramCanvasNodeLayout[],
  fromNodeId: string,
  toNodeId: string,
  reservedSegments: RoutedSegment[]
): { end: DiagramPoint; labelX: number; labelY: number; pathD: string; points: DiagramPoint[]; start: DiagramPoint } {
  const obstacles: DiagramRect[] = [];
  for (const node of nodes) {
    if (node.node.id !== fromNodeId && node.node.id !== toNodeId) {
      obstacles.push(expandedNodeRect(node, lineAvoidanceMargin));
    }
  }
  const leadPoints = portLeadPoints(start, end);
  const routedPoints = routeOrthogonalPath(leadPoints.start, leadPoints.end, nodes, obstacles, reservedSegments);
  const points = simplifyRoute([start.point, ...routedPoints, end.point]);
  const pathD = pathFromPoints(points);
  const labelPoint = labelPointFromRoute(points, []);

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

  return Array.from(values).toSorted((a, b) => a - b);
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

function pathFromPointsWithVerticalLineJumps(points: DiagramPoint[], otherSegments: RoutedSegment[]): string {
  const first = points[0];
  if (!first) return "";

  const commands = [`M ${formatPathNumber(first.x)} ${formatPathNumber(first.y)}`];
  let current = first;

  for (let index = 1; index < points.length; index += 1) {
    const end = points[index];
    if (!end) continue;

    if (sameCoordinate(current.x, end.x) && !sameCoordinate(current.y, end.y)) {
      const direction = end.y >= current.y ? 1 : -1;
      const jumps = verticalLineJumps(current, end, otherSegments);

      jumps.forEach((jump) => {
        const before = { x: current.x, y: jump.y - direction * lineJumpRadius };
        const after = { x: current.x, y: jump.y + direction * lineJumpRadius };
        appendLineCommand(commands, before);
        commands.push([
          "C",
          formatPathNumber(current.x + lineJumpOffset),
          formatPathNumber(before.y),
          formatPathNumber(current.x + lineJumpOffset),
          formatPathNumber(after.y),
          formatPathNumber(after.x),
          formatPathNumber(after.y)
        ].join(" "));
      });
    }

    appendLineCommand(commands, end);
    current = end;
  }

  return commands.join(" ");
}

function appendLineCommand(commands: string[], point: DiagramPoint): void {
  const previousCommand = commands.at(-1);
  const nextCommand = `L ${formatPathNumber(point.x)} ${formatPathNumber(point.y)}`;
  if (previousCommand !== nextCommand) commands.push(nextCommand);
}

function verticalLineJumps(
  start: DiagramPoint,
  end: DiagramPoint,
  otherSegments: RoutedSegment[]
): DiagramPoint[] {
  const direction = end.y >= start.y ? 1 : -1;
  const jumps = otherSegments.flatMap((segment): DiagramPoint[] => {
    if (!sameCoordinate(segment.start.y, segment.end.y) || sameCoordinate(segment.start.x, segment.end.x)) return [];
    const x = start.x;
    const y = segment.start.y;
    if (!valueBetween(y, start.y, end.y) || !valueBetween(x, segment.start.x, segment.end.x)) return [];

    const beforeY = y - direction * lineJumpRadius;
    const afterY = y + direction * lineJumpRadius;
    if (!valueBetween(beforeY, start.y, end.y) || !valueBetween(afterY, start.y, end.y)) return [];
    return [{ x, y }];
  });

  return jumps
    .sort((left, right) => direction * (left.y - right.y))
    .filter((jump, index, sortedJumps) => {
      const previous = sortedJumps[index - 1];
      return !previous || Math.abs(jump.y - previous.y) >= lineJumpRadius * 2;
    });
}

function labelPointFromRoute(points: DiagramPoint[], otherSegments: RoutedSegment[]): DiagramPoint {
  const segments = segmentsFromPoints(points);
  let longest = segments[0];
  let longestLength = -1;
  let bestSafeSegment: RoutedSegment | null = null;
  let bestSafeLength = -1;

  segments.forEach((segment) => {
    const length = Math.abs(segment.end.x - segment.start.x) + Math.abs(segment.end.y - segment.start.y);
    if (length > longestLength) {
      longest = segment;
      longestLength = length;
    }

    safeSegments(segment, otherSegments).forEach((safeSegment) => {
      const safeLength = segmentLength(safeSegment.start, safeSegment.end);
      if (safeLength > bestSafeLength) {
        bestSafeSegment = safeSegment;
        bestSafeLength = safeLength;
      }
    });
  });

  const labelSegment = bestSafeSegment ?? longest;
  if (!labelSegment) return points[0] ?? { x: 0, y: 0 };
  return {
    x: (labelSegment.start.x + labelSegment.end.x) / 2,
    y: (labelSegment.start.y + labelSegment.end.y) / 2
  };
}

function safeSegments(segment: RoutedSegment, otherSegments: RoutedSegment[]): RoutedSegment[] {
  const length = segmentLength(segment.start, segment.end);
  if (length === 0) return [];

  const blocked = labelBlockedIntervals(segment, otherSegments, length);
  if (blocked.length === 0) return [segment];

  const merged = mergeIntervals(blocked);
  const safe: RoutedSegment[] = [];
  let cursor = 0;

  merged.forEach((interval) => {
    if (interval.start > cursor) {
      safe.push(segmentFromDistances(segment, cursor, interval.start));
    }
    cursor = Math.max(cursor, interval.end);
  });

  if (cursor < length) {
    safe.push(segmentFromDistances(segment, cursor, length));
  }

  return safe;
}

function labelBlockedIntervals(
  segment: RoutedSegment,
  otherSegments: RoutedSegment[],
  segmentLengthValue: number
): Array<{ end: number; start: number }> {
  return otherSegments.flatMap((otherSegment) => {
    const crossing = segmentCrossingPoint(segment.start, segment.end, otherSegment.start, otherSegment.end);
    if (!crossing) return [];
    const distance = segmentDistanceFromStart(segment.start, crossing);
    return [{
      end: clamp(distance + labelAvoidanceRadius, 0, segmentLengthValue),
      start: clamp(distance - labelAvoidanceRadius, 0, segmentLengthValue)
    }];
  });
}

function mergeIntervals(intervals: Array<{ end: number; start: number }>): Array<{ end: number; start: number }> {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .toSorted((left, right) => left.start - right.start);
  const merged: Array<{ end: number; start: number }> = [];

  sorted.forEach((interval) => {
    const last = merged.at(-1);
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }
    last.end = Math.max(last.end, interval.end);
  });

  return merged;
}

function segmentFromDistances(segment: RoutedSegment, startDistance: number, endDistance: number): RoutedSegment {
  return {
    end: pointAtSegmentDistance(segment.start, segment.end, endDistance),
    label: segment.label,
    start: pointAtSegmentDistance(segment.start, segment.end, startDistance),
    toNodeId: segment.toNodeId
  };
}

function pointAtSegmentDistance(start: DiagramPoint, end: DiagramPoint, distance: number): DiagramPoint {
  const length = segmentLength(start, end);
  if (length === 0) return start;
  const ratio = distance / length;
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio
  };
}

function segmentDistanceFromStart(start: DiagramPoint, point: DiagramPoint): number {
  return Math.abs(point.x - start.x) + Math.abs(point.y - start.y);
}

function segmentLength(start: DiagramPoint, end: DiagramPoint): number {
  return Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
}

function segmentCrossingPoint(
  aStart: DiagramPoint,
  aEnd: DiagramPoint,
  bStart: DiagramPoint,
  bEnd: DiagramPoint
): DiagramPoint | null {
  const aHorizontal = sameCoordinate(aStart.y, aEnd.y);
  const bHorizontal = sameCoordinate(bStart.y, bEnd.y);
  if (aHorizontal === bHorizontal) return null;

  const horizontalStart = aHorizontal ? aStart : bStart;
  const horizontalEnd = aHorizontal ? aEnd : bEnd;
  const verticalStart = aHorizontal ? bStart : aStart;
  const verticalEnd = aHorizontal ? bEnd : aEnd;
  const point = { x: verticalStart.x, y: horizontalStart.y };

  return valueBetween(point.x, horizontalStart.x, horizontalEnd.x) &&
    valueBetween(point.y, verticalStart.y, verticalEnd.y)
    ? point
    : null;
}

function segmentsFromPoints(points: DiagramPoint[], toNodeId = "", label = ""): RoutedSegment[] {
  const segments: RoutedSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (start && end) segments.push({ end, label, start, toNodeId });
  }
  return segments;
}

function canShareRoutedSegment(segment: RoutedSegment, context: LineRouteContext): boolean {
  if (segment.toNodeId === context.to.node.id) return true;

  return segment.label.trim().length > 0 && segment.label === context.line.label;
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
  return reservedSegments.some((segment) => segmentsConflict(start, end, segment.start, segment.end))
    ? reservedSegmentPenalty
    : 0;
}

function segmentsConflict(aStart: DiagramPoint, aEnd: DiagramPoint, bStart: DiagramPoint, bEnd: DiagramPoint): boolean {
  return segmentsOverlap(aStart, aEnd, bStart, bEnd) || segmentsIntersect(aStart, aEnd, bStart, bEnd);
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

function segmentsIntersect(aStart: DiagramPoint, aEnd: DiagramPoint, bStart: DiagramPoint, bEnd: DiagramPoint): boolean {
  const aHorizontal = sameCoordinate(aStart.y, aEnd.y);
  const bHorizontal = sameCoordinate(bStart.y, bEnd.y);
  if (aHorizontal === bHorizontal) return false;

  const horizontalStart = aHorizontal ? aStart : bStart;
  const horizontalEnd = aHorizontal ? aEnd : bEnd;
  const verticalStart = aHorizontal ? bStart : aStart;
  const verticalEnd = aHorizontal ? bEnd : aEnd;
  const x = verticalStart.x;
  const y = horizontalStart.y;
  return valueBetween(x, horizontalStart.x, horizontalEnd.x) && valueBetween(y, verticalStart.y, verticalEnd.y);
}

function valueBetween(value: number, a: number, b: number): boolean {
  return value > Math.min(a, b) && value < Math.max(a, b);
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
  return stripMarkdownExtension(name);
}
