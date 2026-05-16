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
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPan: GraphPan;
}

interface UseGraphViewportInteractionsInput {
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

export interface GraphViewportInteractions {
  getGraphDelta: (deltaX: number, deltaY: number) => GraphPan;
  graphHandlers: GraphHandlers;
  isPanning: boolean;
  pauseSimulationRef: MutableRefObject<boolean>;
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: GraphViewBox;
}

export function useGraphViewportInteractions({
  setZoom,
  zoom
}: UseGraphViewportInteractionsInput): GraphViewportInteractions {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<GraphDragState | null>(null);
  const pauseSimulationRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 });
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
    pauseSimulationRef.current = true;
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
      onPointerCancel: handleGraphPointerEnd,
      onPointerDown: handleGraphPointerDown,
      onPointerMove: handleGraphPointerMove,
      onPointerUp: handleGraphPointerEnd,
      onWheel: handleGraphWheel
    },
    isPanning,
    pauseSimulationRef,
    svgRef,
    viewBox
  };
}
