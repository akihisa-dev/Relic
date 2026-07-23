import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent
} from "react";

import type { GraphSimulationClient } from "../graph/graphSimulationClient";
import {
  constrainGraphCategoryTranslation,
  constrainGraphCategoryPoint,
  graphCategoryDynamicLayouts,
  graphCategoryRegions,
  translateGraphCategoryNodes
} from "../graph/graphCategoryModel";
import {
  type GraphHighlightState,
  type GraphHoverFocusState,
  clampGraphScale,
  finishGraphPanVelocity,
  graphCategoryAtWorldPoint,
  graphNodeAtCanvasPoint,
  graphNodePrimaryAction,
  graphNodeVisualRadius,
  graphPointerMovedBeyondClickThreshold,
  graphWheelZoomPoint,
  initialGraphViewTransform,
  isGraphNodePrimaryPointerButton,
  nextGraphPanSampleMs,
  nextGraphPanVelocity,
  requestGraphZoom,
  screenToWorld
} from "../graph/graphViewModel";
import type {
  GraphKeyboardState,
  GraphOptions,
  GraphSimNode,
  GraphViewTransform
} from "../graph/graphTypes";
import { useLatest } from "./useLatest";

export const graphCanvasSizeFallback = { height: 600, width: 900 };

interface UseGraphCanvasInteractionsOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  latestOptionsRef: RefObject<GraphOptions>;
  nodesRef: RefObject<Map<string, GraphSimNode>>;
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  requestDraw: () => void;
  setPinnedNodeId: (nodeId: string | null) => void;
  simulationClientRef: RefObject<GraphSimulationClient | null>;
  viewRef: RefObject<GraphViewTransform>;
}

export function useGraphCanvasInteractions({
  canvasRef,
  latestOptionsRef,
  nodesRef,
  onOpenFile,
  onOpenTagSearch,
  requestDraw,
  setPinnedNodeId,
  simulationClientRef,
  viewRef
}: UseGraphCanvasInteractionsOptions) {
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const panSampleMsRef = useRef(0);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverFocusRef = useRef<GraphHoverFocusState>({ id: null, releaseAt: 0 });
  const highlightRef = useRef<GraphHighlightState>({ id: null, strength: 0 });
  const keyboardRef = useRef<GraphKeyboardState>({
    down: false,
    left: false,
    right: false,
    shift: false,
    up: false,
    zoomIn: false,
    zoomOut: false
  });
  const pointerRef = useRef<{
    dragCategory: string | null;
    dragNode: GraphSimNode | null;
    lastX: number;
    lastY: number;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    time: number;
    type: "bubble" | "node" | "pan";
  } | null>(null);
  const openFileRef = useLatest(onOpenFile);
  const openTagSearchRef = useLatest(onOpenTagSearch);

  const nodeAtPoint = useCallback((clientX: number, clientY: number): GraphSimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return graphNodeAtCanvasPoint(
      nodesRef.current.values(),
      { x: clientX - rect.left, y: clientY - rect.top },
      viewRef.current,
      latestOptionsRef.current,
      rect.width || graphCanvasSizeFallback.width,
      rect.height || graphCanvasSizeFallback.height
    );
  }, [canvasRef, latestOptionsRef, nodesRef, viewRef]);

  const categoryAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const point = screenToWorld(
      clientX - rect.left,
      clientY - rect.top,
      rect.width || graphCanvasSizeFallback.width,
      rect.height || graphCanvasSizeFallback.height,
      viewRef.current
    );
    return graphCategoryAtWorldPoint([...nodesRef.current.values()], point);
  }, [canvasRef, nodesRef, viewRef]);

  const setCategoryNodesFixed = useCallback((category: string, fixed: boolean) => {
    for (const node of translateGraphCategoryNodes(nodesRef.current.values(), category, 0, 0)) {
      if (!fixed) {
        node.fx = null;
        node.fy = null;
      }
      simulationClientRef.current?.setNodeFixed(
        node.id,
        fixed ? node.x : null,
        fixed ? node.y : null,
        fixed ? undefined : 0.08
      );
    }
  }, [nodesRef, simulationClientRef]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus();
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;

    const node = nodeAtPoint(event.clientX, event.clientY);
    const category = node ? null : categoryAtPoint(event.clientX, event.clientY);
    if (!node && event.button !== 0) return;
    if (node && !isGraphNodePrimaryPointerButton(event.button)) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = "grabbing";
    requestDraw();

    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      simulationClientRef.current?.setNodeFixed(node.id, node.x, node.y);
    }
    if (category) setCategoryNodesFixed(category, true);

    pointerRef.current = {
      dragCategory: category,
      dragNode: node,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      time: performance.now(),
      type: node ? "node" : category ? "bubble" : "pan"
    };
  }, [categoryAtPoint, nodeAtPoint, requestDraw, setCategoryNodesFixed, simulationClientRef]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    hoverPointRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    const pointer = pointerRef.current;
    if (!pointer) {
      event.currentTarget.style.cursor = "grab";
      requestDraw();
      return;
    }
    event.currentTarget.style.cursor = "grabbing";

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    const now = performance.now();
    const elapsed = Math.max(1, now - pointer.time);
    pointer.time = now;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved ||= graphPointerMovedBeyondClickThreshold(
      event.clientX - pointer.startX,
      event.clientY - pointer.startY
    );

    if (pointer.dragNode) {
      const desiredPoint = {
        x: (pointer.dragNode.fx ?? pointer.dragNode.x) + dx / viewRef.current.scale,
        y: (pointer.dragNode.fy ?? pointer.dragNode.y) + dy / viewRef.current.scale
      };
      const regions = graphCategoryRegions(graphCategoryDynamicLayouts(nodesRef.current.values()));
      const constrainedPoint = constrainGraphCategoryPoint(
        pointer.dragNode,
        regions,
        desiredPoint,
        graphNodeVisualRadius(
          pointer.dragNode,
          latestOptionsRef.current,
          viewRef.current.scale
        ) + 6 / viewRef.current.scale
      );
      pointer.dragNode.fx = constrainedPoint.x;
      pointer.dragNode.fy = constrainedPoint.y;
      pointer.dragNode.x = pointer.dragNode.fx;
      pointer.dragNode.y = pointer.dragNode.fy;
      simulationClientRef.current?.setNodeFixed(pointer.dragNode.id, pointer.dragNode.x, pointer.dragNode.y);
      requestDraw();
      return;
    }

    if (pointer.dragCategory) {
      const translation = constrainGraphCategoryTranslation(
        nodesRef.current.values(),
        pointer.dragCategory,
        dx / viewRef.current.scale,
        dy / viewRef.current.scale
      );
      const translated = translateGraphCategoryNodes(
        nodesRef.current.values(),
        pointer.dragCategory,
        translation.x,
        translation.y
      );
      for (const node of translated) {
        simulationClientRef.current?.setNodeFixed(node.id, node.x, node.y);
      }
      requestDraw();
      return;
    }

    viewRef.current.panX += dx;
    viewRef.current.panY += dy;
    panSampleMsRef.current = nextGraphPanSampleMs(panSampleMsRef.current, elapsed);
    panVelocityRef.current = nextGraphPanVelocity(panVelocityRef.current, dx, dy);
    requestDraw();
  }, [requestDraw, simulationClientRef, viewRef]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;

    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) {
      event.currentTarget.releasePointerCapture(pointer.pointerId);
    }
    if (pointer.dragNode) {
      pointer.dragNode.fx = null;
      pointer.dragNode.fy = null;
      simulationClientRef.current?.setNodeFixed(pointer.dragNode.id, null, null, 0.08);
      if (!pointer.moved) {
        const action = graphNodePrimaryAction(pointer.dragNode);
        if (action?.type === "file") openFileRef.current(action.path);
        if (action?.type === "tagSearch") openTagSearchRef.current(action.tag);
      }
    }
    if (pointer.dragCategory) setCategoryNodesFixed(pointer.dragCategory, false);

    if (pointer.type === "pan") {
      panVelocityRef.current = finishGraphPanVelocity(
        panVelocityRef.current,
        panSampleMsRef.current,
        performance.now() - pointer.time
      );
      panSampleMsRef.current = 0;
    }
    pointerRef.current = null;
    event.currentTarget.style.cursor = "grab";
    requestDraw();
  }, [openFileRef, openTagSearchRef, requestDraw, setCategoryNodesFixed, simulationClientRef]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;

    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) {
      event.currentTarget.releasePointerCapture(pointer.pointerId);
    }
    if (pointer.dragNode) {
      pointer.dragNode.fx = null;
      pointer.dragNode.fy = null;
      simulationClientRef.current?.setNodeFixed(pointer.dragNode.id, null, null, 0.08);
    }
    if (pointer.dragCategory) setCategoryNodesFixed(pointer.dragCategory, false);

    pointerRef.current = null;
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;
    event.currentTarget.style.cursor = "grab";
    requestDraw();
  }, [requestDraw, setCategoryNodesFixed, simulationClientRef]);

  const handlePointerLeave = useCallback(() => {
    hoverPointRef.current = null;
    if (!pointerRef.current && canvasRef.current) canvasRef.current.style.cursor = "grab";
    requestDraw();
  }, [canvasRef, requestDraw]);

  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    setPinnedNodeId(nodeAtPoint(event.clientX, event.clientY)?.id ?? null);
    requestDraw();
  }, [nodeAtPoint, requestDraw, setPinnedNodeId]);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
    const nextScale = clampGraphScale(viewRef.current.targetScale * Math.pow(1.5, -delta / 120));
    const zoomPoint = graphWheelZoomPoint(
      viewRef.current.scale,
      nextScale,
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width || graphCanvasSizeFallback.width,
      rect.height || graphCanvasSizeFallback.height
    );
    requestGraphZoom(viewRef.current, zoomPoint.x, zoomPoint.y, nextScale);
    requestDraw();
  }, [requestDraw, viewRef]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;
    requestDraw();

    const keyMap: Partial<Record<string, keyof GraphKeyboardState>> = {
      "-": "zoomOut",
      "_": "zoomOut",
      "+": "zoomIn",
      "=": "zoomIn",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up"
    };
    const key = keyMap[event.key];
    if (!key) return;
    event.preventDefault();
    keyboard[key] = true;
  }, [requestDraw]);

  const handleKeyUp = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;
    requestDraw();

    const keyMap: Partial<Record<string, keyof GraphKeyboardState>> = {
      "-": "zoomOut",
      "_": "zoomOut",
      "+": "zoomIn",
      "=": "zoomIn",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up"
    };
    const key = keyMap[event.key];
    if (!key) return;
    event.preventDefault();
    keyboard[key] = false;
  }, [requestDraw]);

  const resetInteractionState = useCallback(() => {
    viewRef.current = initialGraphViewTransform();
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;
    hoverPointRef.current = null;
    hoverFocusRef.current = { id: null, releaseAt: 0 };
    highlightRef.current = { id: null, strength: 0 };
    keyboardRef.current = {
      down: false,
      left: false,
      right: false,
      shift: false,
      up: false,
      zoomIn: false,
      zoomOut: false
    };
    setPinnedNodeId(null);
    requestDraw();
  }, [requestDraw, setPinnedNodeId, viewRef]);

  return {
    handleContextMenu,
    handleKeyDown,
    handleKeyUp,
    handlePointerCancel,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    highlightRef,
    hoverFocusRef,
    hoverPointRef,
    keyboardRef,
    panVelocityRef,
    pointerRef,
    resetInteractionState
  };
}
