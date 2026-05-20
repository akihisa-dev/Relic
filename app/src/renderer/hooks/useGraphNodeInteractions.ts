import { useRef } from "react";
import type { KeyboardEvent, MutableRefObject } from "react";

import {
  clamp,
  GRAPH_HEIGHT,
  GRAPH_PADDING,
  GRAPH_WIDTH,
  tickGraphSimulation
} from "../graphLayout";
import type { GraphForceSettings, GraphPan, GraphPoint, GraphSimPoint } from "../graphLayout";
import type { WorkspaceGraphEdge } from "../../shared/ipc";

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
  const nodeFrameRef = useRef<number | null>(null);
  const settleFrameRef = useRef<number | null>(null);
  const settleTicksLeftRef = useRef(0);

  function commitPointsFrame(): void {
    nodeFrameRef.current = null;
    setPoints(pointsRef.current);
  }

  function schedulePointsCommit(): void {
    if (nodeFrameRef.current !== null) return;
    nodeFrameRef.current = window.requestAnimationFrame(commitPointsFrame);
  }

  function cancelPointsCommit(): void {
    if (nodeFrameRef.current === null) return;
    window.cancelAnimationFrame(nodeFrameRef.current);
    nodeFrameRef.current = null;
  }

  function stopSettle(): void {
    settleTicksLeftRef.current = 0;
    if (settleFrameRef.current !== null) {
      window.cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = null;
    }
  }

  function runSettleFrame(): void {
    settleFrameRef.current = null;
    if (settleTicksLeftRef.current <= 0) return;

    pointsRef.current = tickGraphSimulation(pointsRef.current, edges, forceSettings, pinnedPathRef.current, 2);
    setPoints(pointsRef.current);
    settleTicksLeftRef.current -= 1;
    if (settleTicksLeftRef.current > 0) {
      settleFrameRef.current = window.requestAnimationFrame(runSettleFrame);
    }
  }

  function startSettle(tickFrames: number): void {
    stopSettle();
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
    nodeDragStateRef.current = {
      moved: false,
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
    const draggedPoints = pointsRef.current.map((point) => point.path === dragState.path
      ? { ...point, vx: 0, vy: 0, x: nextPosition.x, y: nextPosition.y }
      : point
    );
    pointsRef.current = tickGraphSimulation(draggedPoints, edges, forceSettings, dragState.path, 1);
    schedulePointsCommit();
  }

  function handleNodePointerEnd(event: GraphNodePointerEvent, point: GraphPoint): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    pinnedPathRef.current = null;
    cancelPointsCommit();
    if (event.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    suppressNodeClickRef.current = dragState.moved;
    openSelectedClickRef.current = !dragState.moved && dragState.wasSelectedOnPointerDown;
    if (!dragState.moved) setSelectedPath(point.path);
    if (dragState.moved) {
      setPoints(pointsRef.current);
      startSettle(8);
    }
  }

  function handleNodePointerCancel(event: GraphNodePointerEvent): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    pinnedPathRef.current = null;
    cancelPointsCommit();
    stopSettle();
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
