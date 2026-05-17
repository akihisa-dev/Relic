import { useRef } from "react";
import type { KeyboardEvent, MutableRefObject, PointerEvent } from "react";

import {
  clamp,
  GRAPH_HEIGHT,
  GRAPH_PADDING,
  GRAPH_WIDTH
} from "../graphLayout";
import type { GraphPan, GraphPoint, GraphSimPoint } from "../graphLayout";

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
  onKeyDown: (event: KeyboardEvent<SVGGElement>, point: GraphPoint) => void;
  onPointerCancel: (event: PointerEvent<SVGGElement>) => void;
  onPointerDown: (event: PointerEvent<SVGGElement>, point: GraphPoint) => void;
  onPointerEnter: (path: string) => void;
  onPointerLeave: (path: string) => void;
  onPointerMove: (event: PointerEvent<SVGGElement>) => void;
  onPointerUp: (event: PointerEvent<SVGGElement>, point: GraphPoint) => void;
}

export function useGraphNodeInteractions({
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

  function handleNodePointerDown(event: PointerEvent<SVGGElement>, point: GraphPoint): void {
    if (event.button !== 0) return;

    event.stopPropagation();
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
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedPath(point.path);
  }

  function handleNodePointerMove(event: PointerEvent<SVGGElement>): void {
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
    const nextPoints = pointsRef.current.map((point) => point.path === dragState.path
      ? { ...point, vx: 0, vy: 0, x: nextPosition.x, y: nextPosition.y }
      : point
    );
    setPoints(nextPoints);
  }

  function handleNodePointerEnd(event: PointerEvent<SVGGElement>, point: GraphPoint): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    pinnedPathRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressNodeClickRef.current = dragState.moved;
    openSelectedClickRef.current = !dragState.moved && dragState.wasSelectedOnPointerDown;
    if (!dragState.moved) setSelectedPath(point.path);
  }

  function handleNodePointerCancel(event: PointerEvent<SVGGElement>): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    pinnedPathRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    openSelectedClickRef.current = false;
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, point: GraphPoint): void {
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
