import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject, WheelEvent } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import {
  buildGraphViewBox,
  clamp,
  collectRelatedGraphPaths,
  GRAPH_HEIGHT,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_PADDING,
  GRAPH_WIDTH,
  layoutGraph,
  tickGraphSimulation
} from "../graphLayout";
import type { GraphForceSettings, GraphPan, GraphPoint, GraphSimPoint, GraphViewBox } from "../graphLayout";

interface GraphDragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: GraphPan;
}

interface GraphNodeDragState {
  moved: boolean;
  path: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPoint: GraphPan;
}

interface UseGraphCanvasInteractionsInput {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  forceSettings: GraphForceSettings;
  nodes: WorkspaceGraphNode[];
  onOpenFile: (path: string) => void;
  selectedPath: string | null;
  setFocusedPath: (path: string | null | ((current: string | null) => string | null)) => void;
  setSelectedPath: (path: string | null) => void;
  setZoom: (value: number) => void;
  zoom: number;
}

export interface GraphHandlers {
  onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
  onPointerCancel: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
  onWheel: (event: WheelEvent<SVGSVGElement>) => void;
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

export function useGraphCanvasInteractions({
  edges,
  focusedPath,
  forceSettings,
  nodes,
  onOpenFile,
  selectedPath,
  setFocusedPath,
  setSelectedPath,
  setZoom,
  zoom
}: UseGraphCanvasInteractionsInput): {
  graphHandlers: GraphHandlers;
  isPanning: boolean;
  nodeHandlers: GraphNodeHandlers;
  points: GraphSimPoint[];
  relatedPaths: Set<string>;
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: GraphViewBox;
} {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<GraphDragState | null>(null);
  const suppressNodeClickRef = useRef(false);
  const nodeDragStateRef = useRef<GraphNodeDragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const simPointsRef = useRef<GraphSimPoint[]>([]);
  const [simPoints, setSimPoints] = useState<GraphSimPoint[]>([]);
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 });

  useEffect(() => {
    const seedPoints = layoutGraph(nodes, edges, forceSettings);
    const existingPoints = new Map(simPointsRef.current.map((point) => [point.path, point]));
    const nextPoints = seedPoints.map((point) => {
      const existing = existingPoints.get(point.path);
      return {
        ...point,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        x: existing?.x ?? point.x,
        y: existing?.y ?? point.y
      };
    });

    simPointsRef.current = nextPoints;
    setSimPoints(nextPoints);
  }, [edges, forceSettings, nodes]);

  useEffect(() => {
    if (nodes.length === 0) return;

    let frameId = 0;

    function tick(): void {
      if (dragStateRef.current) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const nextPoints = tickGraphSimulation(
        simPointsRef.current,
        edges,
        forceSettings,
        nodeDragStateRef.current?.path ?? null
      );
      simPointsRef.current = nextPoints;
      setSimPoints(nextPoints);

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [edges, forceSettings, nodes.length]);

  const points = simPoints;
  const relatedPaths = useMemo(() => collectRelatedGraphPaths(edges, focusedPath), [edges, focusedPath]);
  const viewBox = buildGraphViewBox(zoom, pan);

  function getGraphDelta(deltaX: number, deltaY: number): GraphPan {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return { x: deltaX, y: deltaY };
    return {
      x: deltaX * (viewBox.width / bounds.width),
      y: deltaY * (viewBox.height / bounds.height)
    };
  }

  function handleGraphWheel(event: WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const nextZoom = clamp(zoom - event.deltaY * 0.001, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    setZoom(Number(nextZoom.toFixed(2)));
  }

  function handleGraphKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    const panStep = (event.shiftKey ? 72 : 28) / zoom;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(Number(clamp(zoom + 0.1, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM).toFixed(2)));
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      setZoom(Number(clamp(zoom - 0.1, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM).toFixed(2)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setPan((current) => ({ ...current, y: current.y - panStep }));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPan((current) => ({ ...current, y: current.y + panStep }));
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPan((current) => ({ ...current, x: current.x - panStep }));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPan((current) => ({ ...current, x: current.x + panStep }));
    }
  }

  function handleGraphPointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest(".graph-node-hit")) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: pan
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function handleGraphPointerMove(event: PointerEvent<SVGSVGElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const delta = getGraphDelta(event.clientX - dragState.startClientX, event.clientY - dragState.startClientY);
    setPan({
      x: dragState.startPan.x - delta.x,
      y: dragState.startPan.y - delta.y
    });
  }

  function handleGraphPointerEnd(event: PointerEvent<SVGSVGElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
  }

  function handleNodeClick(point: GraphPoint): void {
    if (suppressNodeClickRef.current) {
      suppressNodeClickRef.current = false;
      return;
    }
    setSelectedPath(point.path);
    onOpenFile(point.path);
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
      startPoint: { x: point.x, y: point.y }
    };
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
    const nextPosition = {
      x: clamp(dragState.startPoint.x + graphDelta.x, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING),
      y: clamp(dragState.startPoint.y + graphDelta.y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING)
    };
    const nextPoints = simPointsRef.current.map((point) => point.path === dragState.path
      ? { ...point, vx: 0, vy: 0, x: nextPosition.x, y: nextPosition.y }
      : point
    );
    simPointsRef.current = nextPoints;
    setSimPoints(nextPoints);
  }

  function handleNodePointerEnd(event: PointerEvent<SVGGElement>, point: GraphPoint): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressNodeClickRef.current = dragState.moved;
    if (!dragState.moved) setSelectedPath(point.path);
  }

  function handleNodePointerCancel(event: PointerEvent<SVGGElement>): void {
    const dragState = nodeDragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    event.stopPropagation();
    nodeDragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleNodeKeyDown(event: KeyboardEvent<SVGGElement>, point: GraphPoint): void {
    if (event.key === "Enter") {
      event.preventDefault();
      setSelectedPath(point.path);
      onOpenFile(point.path);
    }
    if (event.key === " ") {
      event.preventDefault();
      setSelectedPath(point.path);
    }
  }

  return {
    graphHandlers: {
      onKeyDown: handleGraphKeyDown,
      onPointerCancel: handleGraphPointerEnd,
      onPointerDown: handleGraphPointerDown,
      onPointerMove: handleGraphPointerMove,
      onPointerUp: handleGraphPointerEnd,
      onWheel: handleGraphWheel
    },
    isPanning,
    nodeHandlers: {
      onClick: handleNodeClick,
      onKeyDown: handleNodeKeyDown,
      onPointerCancel: handleNodePointerCancel,
      onPointerDown: handleNodePointerDown,
      onPointerEnter: setFocusedPath,
      onPointerLeave: (path) => setFocusedPath((current) => current === path ? null : current),
      onPointerMove: handleNodePointerMove,
      onPointerUp: handleNodePointerEnd
    },
    points,
    relatedPaths,
    svgRef,
    viewBox
  };
}
