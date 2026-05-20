import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MutableRefObject, PointerEvent, RefObject, WheelEvent } from "react";

import {
  buildGraphViewBox,
  clamp,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM
} from "../graphLayout";
import type { GraphPan, GraphPoint, GraphViewBox } from "../graphLayout";

interface GraphDragState {
  moved: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: GraphPan;
}

interface GraphViewportSnapshot {
  pan: GraphPan;
  zoom: number;
}

interface UseGraphViewportInteractionsInput {
  fitKey?: string;
  onBackgroundClick?: () => void;
  pauseSimulationRef?: MutableRefObject<boolean>;
  points?: GraphPoint[];
  setZoom: (value: number) => void;
  zoom: number;
}

export interface GraphHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
}

export interface GraphViewportInteractions {
  getGraphDelta: (deltaX: number, deltaY: number) => GraphPan;
  graphHandlers: GraphHandlers;
  isPanning: boolean;
  pauseSimulationRef: MutableRefObject<boolean>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  viewBox: GraphViewBox;
}

export function useGraphViewportInteractions({
  fitKey = "",
  onBackgroundClick,
  pauseSimulationRef: providedPauseSimulationRef,
  points = [],
  setZoom,
  zoom
}: UseGraphViewportInteractionsInput): GraphViewportInteractions {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<GraphDragState | null>(null);
  const internalPauseSimulationRef = useRef(false);
  const pauseSimulationRef = providedPauseSimulationRef ?? internalPauseSimulationRef;
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 });
  const viewBox = buildGraphViewBox(zoom, pan, points);
  const viewportSnapshotRef = useRef<GraphViewportSnapshot>({ pan, zoom });
  const pendingWheelViewportRef = useRef<GraphViewportSnapshot | null>(null);
  const pendingPanViewportRef = useRef<GraphViewportSnapshot | null>(null);
  const wheelFrameRef = useRef<number | null>(null);
  const panFrameRef = useRef<number | null>(null);

  viewportSnapshotRef.current = { pan, zoom };

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    cancelPendingWheelViewport();
    cancelPendingPanViewport();
  }, [fitKey]);

  useEffect(() => () => {
    cancelPendingWheelViewport();
    cancelPendingPanViewport();
  }, []);

  function getGraphDelta(deltaX: number, deltaY: number): GraphPan {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return { x: deltaX, y: deltaY };
    return {
      x: deltaX * (viewBox.width / bounds.width),
      y: deltaY * (viewBox.height / bounds.height)
    };
  }

  function cancelPendingWheelViewport(): void {
    pendingWheelViewportRef.current = null;
    if (wheelFrameRef.current !== null) {
      window.cancelAnimationFrame(wheelFrameRef.current);
      wheelFrameRef.current = null;
    }
  }

  function cancelPendingPanViewport(): void {
    pendingPanViewportRef.current = null;
    if (panFrameRef.current !== null) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = null;
    }
  }

  function applyViewportSnapshot(snapshot: GraphViewportSnapshot): void {
    viewportSnapshotRef.current = snapshot;
    setPan(snapshot.pan);
    setZoom(snapshot.zoom);
  }

  function flushPendingWheelViewport(): GraphViewportSnapshot {
    const pending = pendingWheelViewportRef.current;
    if (!pending) return viewportSnapshotRef.current;

    cancelPendingWheelViewport();
    applyViewportSnapshot(pending);
    return pending;
  }

  function flushPendingPanViewport(): GraphViewportSnapshot {
    const pending = pendingPanViewportRef.current;
    if (!pending) return viewportSnapshotRef.current;

    cancelPendingPanViewport();
    viewportSnapshotRef.current = pending;
    setPan(pending.pan);
    return pending;
  }

  function flushPendingViewport(): GraphViewportSnapshot {
    flushPendingWheelViewport();
    return flushPendingPanViewport();
  }

  function commitPendingWheelViewport(): void {
    const pending = pendingWheelViewportRef.current;
    if (!pending) return;

    pendingWheelViewportRef.current = null;
    wheelFrameRef.current = null;
    applyViewportSnapshot(pending);
  }

  function scheduleWheelViewportCommit(): void {
    if (wheelFrameRef.current !== null) return;
    wheelFrameRef.current = window.requestAnimationFrame(commitPendingWheelViewport);
  }

  function commitPendingPanViewport(): void {
    const pending = pendingPanViewportRef.current;
    if (!pending) return;

    pendingPanViewportRef.current = null;
    panFrameRef.current = null;
    viewportSnapshotRef.current = pending;
    setPan(pending.pan);
  }

  function schedulePanViewportCommit(): void {
    if (panFrameRef.current !== null) return;
    panFrameRef.current = window.requestAnimationFrame(commitPendingPanViewport);
  }

  function handleGraphWheel(event: WheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    const currentViewport = pendingWheelViewportRef.current ?? viewportSnapshotRef.current;
    const currentViewBox = buildGraphViewBox(currentViewport.zoom, currentViewport.pan, points);
    const nextZoom = Number(clamp(currentViewport.zoom * Math.exp(-event.deltaY * 0.0014), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM).toFixed(4));
    const bounds = surfaceRef.current?.getBoundingClientRect();

    if (bounds && bounds.width > 0 && bounds.height > 0 && nextZoom !== currentViewport.zoom) {
      const ratioX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
      const ratioY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
      const nextViewBoxWithoutPan = buildGraphViewBox(nextZoom, { x: 0, y: 0 }, points);
      const anchorX = currentViewBox.x + ratioX * currentViewBox.width;
      const anchorY = currentViewBox.y + ratioY * currentViewBox.height;
      pendingWheelViewportRef.current = {
        pan: {
          x: anchorX - ratioX * nextViewBoxWithoutPan.width - nextViewBoxWithoutPan.x,
          y: anchorY - ratioY * nextViewBoxWithoutPan.height - nextViewBoxWithoutPan.y
        },
        zoom: nextZoom
      };
    } else {
      pendingWheelViewportRef.current = {
        pan: currentViewport.pan,
        zoom: nextZoom
      };
    }

    scheduleWheelViewportCommit();
  }

  function handleGraphKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const currentViewport = flushPendingViewport();
    const panStep = (event.shiftKey ? 72 : 28) / currentViewport.zoom;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setZoom(Number(clamp(currentViewport.zoom + 0.1, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM).toFixed(2)));
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      setZoom(Number(clamp(currentViewport.zoom - 0.1, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM).toFixed(2)));
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

  function handleGraphPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;

    const currentViewport = flushPendingViewport();
    dragStateRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: currentViewport.pan
    };
    pauseSimulationRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function handleGraphPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const delta = getGraphDelta(event.clientX - dragState.startClientX, event.clientY - dragState.startClientY);
    const moved = Math.hypot(event.clientX - dragState.startClientX, event.clientY - dragState.startClientY) > 3;
    dragStateRef.current = { ...dragState, moved: dragState.moved || moved };
    pendingPanViewportRef.current = {
      pan: {
        x: dragState.startPan.x - delta.x,
        y: dragState.startPan.y - delta.y
      },
      zoom: viewportSnapshotRef.current.zoom
    };
    schedulePanViewportCommit();
  }

  function handleGraphPointerEnd(event: PointerEvent<HTMLDivElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    flushPendingPanViewport();
    dragStateRef.current = null;
    pauseSimulationRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!dragState.moved) onBackgroundClick?.();
    setIsPanning(false);
  }

  function handleGraphPointerCancel(event: PointerEvent<HTMLDivElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    cancelPendingPanViewport();
    dragStateRef.current = null;
    pauseSimulationRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
  }

  return {
    getGraphDelta,
    graphHandlers: {
      onKeyDown: handleGraphKeyDown,
      onPointerCancel: handleGraphPointerCancel,
      onPointerDown: handleGraphPointerDown,
      onPointerMove: handleGraphPointerMove,
      onPointerUp: handleGraphPointerEnd,
      onWheel: handleGraphWheel
    },
    isPanning,
    pauseSimulationRef,
    surfaceRef,
    viewBox
  };
}
