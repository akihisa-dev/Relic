import { useRef, useState } from "react";
import type { KeyboardEvent, MutableRefObject, PointerEvent, RefObject, WheelEvent } from "react";

import {
  buildGraphViewBox,
  clamp,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM
} from "../graphLayout";
import type { GraphPan, GraphViewBox } from "../graphLayout";

interface GraphDragState {
  moved: boolean;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: GraphPan;
}

interface UseGraphViewportInteractionsInput {
  onBackgroundClick?: () => void;
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
  onBackgroundClick,
  setZoom,
  zoom
}: UseGraphViewportInteractionsInput): GraphViewportInteractions {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<GraphDragState | null>(null);
  const pauseSimulationRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 });
  const viewBox = buildGraphViewBox(zoom, pan);

  function getGraphDelta(deltaX: number, deltaY: number): GraphPan {
    const bounds = surfaceRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return { x: deltaX, y: deltaY };
    return {
      x: deltaX * (viewBox.width / bounds.width),
      y: deltaY * (viewBox.height / bounds.height)
    };
  }

  function handleGraphWheel(event: WheelEvent<HTMLDivElement>): void {
    event.preventDefault();
    const nextZoom = clamp(zoom - event.deltaY * 0.001, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    setZoom(Number(nextZoom.toFixed(2)));
  }

  function handleGraphKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
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

  function handleGraphPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;

    dragStateRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: pan
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
    setPan({
      x: dragState.startPan.x - delta.x,
      y: dragState.startPan.y - delta.y
    });
  }

  function handleGraphPointerEnd(event: PointerEvent<HTMLDivElement>): void {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    dragStateRef.current = null;
    pauseSimulationRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!dragState.moved) onBackgroundClick?.();
    setIsPanning(false);
  }

  return {
    getGraphDelta,
    graphHandlers: {
      onKeyDown: handleGraphKeyDown,
      onPointerCancel: handleGraphPointerEnd,
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
