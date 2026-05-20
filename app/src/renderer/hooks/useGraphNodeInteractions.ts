import { useRef } from "react";
import type { KeyboardEvent, MutableRefObject } from "react";

import {
  clamp,
  GRAPH_HEIGHT,
  GRAPH_PADDING,
  GRAPH_WIDTH
} from "../graphLayout";
import type { GraphForceSettings, GraphPan, GraphPoint, GraphSimPoint } from "../graphLayout";
import type { WorkspaceGraphEdge } from "../../shared/ipc";
import type { GraphGeometryController } from "./useGraphSimulation";

export interface GraphNodePointerEvent {
  button: number;
  clientX: number;
  clientY: number;
  currentTarget?: {
    hasPointerCapture?: (pointerId: number) => boolean;
    releasePointerCapture?: (pointerId: number) => void;
    setPointerCapture?: (pointerId: number) => void;
  };
  pointerId: number;
  stopPropagation: () => void;
}

interface GraphNodeDragState {
  moved: boolean;
  neighborhoodPaths: Set<string>;
  path: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPoint: GraphPan;
  wasSelectedOnPointerDown: boolean;
}

interface UseGraphNodeInteractionsInput {
  edges: WorkspaceGraphEdge[];
  forceSettings: GraphForceSettings;
  getGraphDelta: (deltaX: number, deltaY: number) => GraphPan;
  geometryController: GraphGeometryController;
  onOpenFile: (path: string) => void;
  pinnedPathRef: MutableRefObject<string | null>;
  pointsRef: MutableRefObject<GraphSimPoint[]>;
  selectedPath: string | null;
  setFocusedPath: (path: string | null | ((current: string | null) => string | null)) => void;
  setPoints: (points: GraphSimPoint[]) => void;
  setSelectedPath: (path: string | null) => void;
}

export interface GraphNodeHandlers {
  onClick: (point: GraphPoint) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, point: GraphPoint) => void;
  onPointerCancel: (event: GraphNodePointerEvent) => void;
  onPointerDown: (event: GraphNodePointerEvent, point: GraphPoint) => void;
  onPointerEnter: (path: string) => void;
  onPointerLeave: (path: string) => void;
  onPointerMove: (event: GraphNodePointerEvent) => void;
  onPointerUp: (event: GraphNodePointerEvent, point: GraphPoint) => void;
}

export function useGraphNodeInteractions({
  edges,
  forceSettings,
  getGraphDelta,
  geometryController,
  onOpenFile,
  pinnedPathRef,
  pointsRef,
  selectedPath,
  setFocusedPath,
  setPoints,
  setSelectedPath
}: UseGraphNodeInteractionsInput): GraphNodeHandlers {
  const openSelectedClickRef = useRef(false);
  const suppressNodeClickRef = useRef(false);
  const nodeDragStateRef = useRef<GraphNodeDragState | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const settlePathsRef = useRef<Set<string>>(new Set());
  const settleTicksLeftRef = useRef(0);

  function stopSettle(): void {
    settleTicksLeftRef.current = 0;
    settlePathsRef.current = new Set();
    if (settleFrameRef.current !== null) {
      window.cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = null;
    }
  }

  function runSettleFrame(): void {
    settleFrameRef.current = null;
    if (settleTicksLeftRef.current <= 0) return;

    pointsRef.current = relaxGraphNeighborhood(pointsRef.current, edges, forceSettings, settlePathsRef.current, pinnedPathRef.current, null, 2);
    geometryController.notifyChanged(settlePathsRef.current);
    settleTicksLeftRef.current -= 1;
    if (settleTicksLeftRef.current > 0) {
      settleFrameRef.current = window.requestAnimationFrame(runSettleFrame);
    } else {
      setPoints(pointsRef.current);
    }
  }

  function startSettle(paths: Set<string>, tickFrames: number): void {
    stopSettle();
    settlePathsRef.current = new Set(paths);
    settleTicksLeftRef.current = tickFrames;
    settleFrameRef.current = window.requestAnimationFrame(runSettleFrame);
  }

  function handleNodeClick(point: GraphPoint): void {
    if (suppressNodeClickRef.current) {
      suppressNodeClickRef.current = false;
      return;
    }
    if (openSelectedClickRef.current) {
      openSelectedClickRef.current = false;
      onOpenFile(point.path);
      return;
    }
    setSelectedPath(point.path);
  }

  function handleNodePointerDown(event: GraphNodePointerEvent, point: GraphPoint): void {
    if (event.button !== 0) return;

    event.stopPropagation();
    stopSettle();
    const neighborhoodPaths = collectGraphNeighborhoodPaths(edges, point.path, 2);
    nodeDragStateRef.current = {
      moved: false,
      neighborhoodPaths,
      path: point.path,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPoint: { x: point.x, y: point.y },
      wasSelectedOnPointerDown: selectedPath === point.path
    };
    openSelectedClickRef.current = selectedPath === point.path;
    pinnedPathRef.current = point.path;
    event.currentTarget?.setPointerCapture?.(event.pointerId);
    setSelectedPath(point.path);
  }

  function handleNodePointerMove(event: GraphNodePointerEvent): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    const clientDeltaX = event.clientX - dragState.startClientX;
    const clientDeltaY = event.clientY - dragState.startClientY;
    const graphDelta = getGraphDelta(clientDeltaX, clientDeltaY);
    const moved = Math.hypot(clientDeltaX, clientDeltaY) > 3;
    if (!moved && !dragState.moved) return;

    nodeDragStateRef.current = { ...dragState, moved: dragState.moved || moved };
    openSelectedClickRef.current = false;
    const nextPosition = {
      x: clamp(dragState.startPoint.x + graphDelta.x, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING),
      y: clamp(dragState.startPoint.y + graphDelta.y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING)
    };
    pointsRef.current = relaxGraphNeighborhood(pointsRef.current, edges, forceSettings, dragState.neighborhoodPaths, dragState.path, nextPosition, 1);
    geometryController.notifyChanged(dragState.neighborhoodPaths);
  }

  function handleNodePointerEnd(event: GraphNodePointerEvent, point: GraphPoint): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    pinnedPathRef.current = null;
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    suppressNodeClickRef.current = dragState.moved;
    openSelectedClickRef.current = !dragState.moved && dragState.wasSelectedOnPointerDown;
    if (!dragState.moved) setSelectedPath(point.path);
    if (dragState.moved) {
      setPoints(pointsRef.current);
      startSettle(dragState.neighborhoodPaths, 8);
    }
  }

  function handleNodePointerCancel(event: GraphNodePointerEvent): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    pinnedPathRef.current = null;
    stopSettle();
    geometryController.notifyChanged(null);
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    openSelectedClickRef.current = false;
  }

  function handleNodeKeyDown(event: KeyboardEvent<HTMLDivElement>, point: GraphPoint): void {
    if (event.key === "Enter") {
      event.preventDefault();
      setSelectedPath(point.path);
    }
    if (event.key === " ") {
      event.preventDefault();
      setSelectedPath(point.path);
    }
  }

  return {
    onClick: handleNodeClick,
    onKeyDown: handleNodeKeyDown,
    onPointerCancel: handleNodePointerCancel,
    onPointerDown: handleNodePointerDown,
    onPointerEnter: setFocusedPath,
    onPointerLeave: (path) => setFocusedPath((current) => current === path ? null : current),
    onPointerMove: handleNodePointerMove,
    onPointerUp: handleNodePointerEnd
  };
}

export function collectGraphNeighborhoodPaths(
  edges: WorkspaceGraphEdge[],
  rootPath: string,
  depth: number
): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourcePath)) adjacency.set(edge.sourcePath, new Set());
    if (!adjacency.has(edge.targetPath)) adjacency.set(edge.targetPath, new Set());
    adjacency.get(edge.sourcePath)?.add(edge.targetPath);
    adjacency.get(edge.targetPath)?.add(edge.sourcePath);
  }

  const visited = new Set([rootPath]);
  let frontier = new Set([rootPath]);
  for (let distance = 0; distance < depth; distance += 1) {
    const next = new Set<string>();
    for (const path of frontier) {
      for (const neighbor of adjacency.get(path) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        next.add(neighbor);
      }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }
  return visited;
}

export function relaxGraphNeighborhood(
  points: GraphSimPoint[],
  edges: WorkspaceGraphEdge[],
  forceSettings: GraphForceSettings,
  neighborhoodPaths: Set<string>,
  pinnedPath: string | null,
  pinnedPosition: GraphPan | null,
  iterations: number
): GraphSimPoint[] {
  if (neighborhoodPaths.size === 0) return points;

  const pointByPath = new Map<string, GraphSimPoint>();
  for (const point of points) {
    pointByPath.set(point.path, neighborhoodPaths.has(point.path) ? { ...point } : point);
  }

  if (pinnedPath && pinnedPosition) {
    const pinned = pointByPath.get(pinnedPath);
    if (pinned) {
      pinned.x = pinnedPosition.x;
      pinned.y = pinnedPosition.y;
      pinned.vx = 0;
      pinned.vy = 0;
    }
  }

  const localEdges = edges.filter((edge) =>
    neighborhoodPaths.has(edge.sourcePath) &&
    neighborhoodPaths.has(edge.targetPath) &&
    pointByPath.has(edge.sourcePath) &&
    pointByPath.has(edge.targetPath)
  );
  const tickCount = Math.max(1, iterations);
  const targetDistance = Math.min(180, Math.max(36, forceSettings.linkDistance));
  const linkStrength = 0.045 * forceSettings.linkForce;
  const centerStrength = 0.0025 * forceSettings.centerForce;

  for (let tick = 0; tick < tickCount; tick += 1) {
    for (const edge of localEdges) {
      const source = pointByPath.get(edge.sourcePath);
      const target = pointByPath.get(edge.targetPath);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(0.001, Math.hypot(dx, dy));
      const correction = (distance - targetDistance) * linkStrength;
      const offsetX = (dx / distance) * correction;
      const offsetY = (dy / distance) * correction;
      moveLocalPoint(source, pinnedPath, offsetX, offsetY);
      moveLocalPoint(target, pinnedPath, -offsetX, -offsetY);
    }

    for (const path of neighborhoodPaths) {
      if (path === pinnedPath) continue;
      const point = pointByPath.get(path);
      if (!point) continue;

      const centerPullX = (GRAPH_WIDTH / 2 - point.x) * centerStrength;
      const centerPullY = (GRAPH_HEIGHT / 2 - point.y) * centerStrength;
      point.x = clamp(point.x + centerPullX, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
      point.y = clamp(point.y + centerPullY, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
      point.vx = centerPullX;
      point.vy = centerPullY;
    }
  }

  return points.map((point) => {
    const nextPoint = pointByPath.get(point.path) ?? point;
    return neighborhoodPaths.has(point.path) ? nextPoint : point;
  });
}

function moveLocalPoint(point: GraphSimPoint, pinnedPath: string | null, offsetX: number, offsetY: number): void {
  if (point.path === pinnedPath) return;
  point.x = clamp(point.x + offsetX, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
  point.y = clamp(point.y + offsetY, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
  point.vx = offsetX;
  point.vy = offsetY;
}
