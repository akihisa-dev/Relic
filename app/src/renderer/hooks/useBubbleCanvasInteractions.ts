import {
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent
} from "react";

import type { BubbleSimulationClient } from "../bubble/bubbleSimulationClient";
import {
  constrainBubbleNodeToCategoryRegions,
  bubbleCategoryCenterOffsetForNodeDrag,
  bubbleCategoryDynamicLayouts,
  bubbleCategoryRegions,
  normalizeBubbleCategory
} from "../bubble/bubbleCategoryModel";
import {
  translateBubbleCategoryNodesWithPush
} from "../bubble/bubbleCategoryTranslation";
import {
  type BubbleHighlightState,
  type BubbleHoverFocusState,
  clampBubbleScale,
  finishBubblePanVelocity,
  bubbleCategoryAtWorldPoint,
  bubbleNodeAtCanvasPoint,
  graphNodePrimaryAction,
  bubbleNodeVisualRadius,
  bubblePointerMovedBeyondClickThreshold,
  bubbleWheelZoomPoint,
  initialBubbleViewTransform,
  isBubbleNodePrimaryPointerButton,
  nextBubblePanSampleMs,
  nextBubblePanVelocity,
  requestBubbleZoom,
  screenToWorld
} from "../bubble/bubbleViewModel";
import type {
  BubbleCategoryDragTarget,
  BubbleKeyboardState,
  BubbleOptions,
  BubbleSimNode,
  BubbleViewTransform
} from "../bubble/bubbleTypes";
import { useLatest } from "./useLatest";

export const bubbleCanvasSizeFallback = { height: 600, width: 900 };

interface UseBubbleCanvasInteractionsOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  latestOptionsRef: RefObject<BubbleOptions>;
  nodesRef: RefObject<Map<string, BubbleSimNode>>;
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  requestDraw: () => void;
  setPinnedNodeId: (nodeId: string | null) => void;
  simulationClientRef: RefObject<BubbleSimulationClient | null>;
  viewRef: RefObject<BubbleViewTransform>;
}

export function useBubbleCanvasInteractions({
  canvasRef,
  latestOptionsRef,
  nodesRef,
  onOpenFile,
  onOpenTagSearch,
  requestDraw,
  setPinnedNodeId,
  simulationClientRef,
  viewRef
}: UseBubbleCanvasInteractionsOptions) {
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const panSampleMsRef = useRef(0);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
  const hoverFocusRef = useRef<BubbleHoverFocusState>({ id: null, releaseAt: 0 });
  const highlightRef = useRef<BubbleHighlightState>({ id: null, strength: 0 });
  const keyboardRef = useRef<BubbleKeyboardState>({
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
    dragCategoryTarget: BubbleCategoryDragTarget | null;
    dragNode: BubbleSimNode | null;
    lastX: number;
    lastY: number;
    moved: boolean;
    nodeVelocityX: number;
    nodeVelocityY: number;
    pointerId: number;
    startX: number;
    startY: number;
    time: number;
    type: "bubble" | "node" | "pan";
  } | null>(null);
  const openFileRef = useLatest(onOpenFile);
  const openTagSearchRef = useLatest(onOpenTagSearch);

  const nodeAtPoint = useCallback((clientX: number, clientY: number): BubbleSimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return bubbleNodeAtCanvasPoint(
      nodesRef.current.values(),
      { x: clientX - rect.left, y: clientY - rect.top },
      viewRef.current,
      latestOptionsRef.current,
      rect.width || bubbleCanvasSizeFallback.width,
      rect.height || bubbleCanvasSizeFallback.height
    );
  }, [canvasRef, latestOptionsRef, nodesRef, viewRef]);

  const categoryAtPoint = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const point = screenToWorld(
      clientX - rect.left,
      clientY - rect.top,
      rect.width || bubbleCanvasSizeFallback.width,
      rect.height || bubbleCanvasSizeFallback.height,
      viewRef.current
    );
    return bubbleCategoryAtWorldPoint([...nodesRef.current.values()], point);
  }, [canvasRef, nodesRef, viewRef]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus();
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;

    const node = nodeAtPoint(event.clientX, event.clientY);
    const category = node ? null : categoryAtPoint(event.clientX, event.clientY);
    if (!node && event.button !== 0) return;
    if (node && !isBubbleNodePrimaryPointerButton(event.button)) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor = "grabbing";
    requestDraw();

    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      simulationClientRef.current?.setNodeFixed(node.id, node.x, node.y);
    }
    const categoryNodes = category
      ? [...nodesRef.current.values()].filter((candidate) =>
          normalizeBubbleCategory(candidate.category) === category
        )
      : [];
    const dragCategoryTarget = categoryNodes.length > 0 ? {
      centerX: categoryNodes.reduce((sum, candidate) => sum + candidate.x, 0) / categoryNodes.length,
      centerY: categoryNodes.reduce((sum, candidate) => sum + candidate.y, 0) / categoryNodes.length,
      nodeIds: categoryNodes.map((candidate) => candidate.id)
    } : null;
    if (dragCategoryTarget) {
      simulationClientRef.current?.setCategoryDragTarget({
        ...dragCategoryTarget,
        nodeIds: [...dragCategoryTarget.nodeIds]
      });
    }

    pointerRef.current = {
      dragCategory: category,
      dragCategoryTarget,
      dragNode: node,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      nodeVelocityX: 0,
      nodeVelocityY: 0,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      time: performance.now(),
      type: node ? "node" : category ? "bubble" : "pan"
    };
  }, [categoryAtPoint, nodeAtPoint, requestDraw, simulationClientRef]);

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
    pointer.moved ||= bubblePointerMovedBeyondClickThreshold(
      event.clientX - pointer.startX,
      event.clientY - pointer.startY
    );

    if (pointer.dragNode) {
      const desiredPoint = {
        x: (pointer.dragNode.fx ?? pointer.dragNode.x) + dx / viewRef.current.scale,
        y: (pointer.dragNode.fy ?? pointer.dragNode.y) + dy / viewRef.current.scale
      };
      const dragPadding = bubbleNodeVisualRadius(
        pointer.dragNode,
        latestOptionsRef.current,
        viewRef.current.scale
      ) + 6 / viewRef.current.scale;
      const graphNodes = [...nodesRef.current.values()];
      const layouts = bubbleCategoryDynamicLayouts(graphNodes);
      const categoryCenterOffset = bubbleCategoryCenterOffsetForNodeDrag(
        pointer.dragNode,
        layouts,
        desiredPoint,
        dragPadding
      );
      const singletonLayout = categoryCenterOffset
        ? layouts.find((layout) =>
            layout.category === normalizeBubbleCategory(pointer.dragNode?.category)
          )
        : null;
      const projectedNodes = graphNodes.map((node) => (
        node.id === pointer.dragNode?.id
          ? {
              ...node,
              categoryCenterOffsetX: categoryCenterOffset?.x ??
                node.categoryCenterOffsetX,
              categoryCenterOffsetY: categoryCenterOffset?.y ??
                node.categoryCenterOffsetY,
              x: desiredPoint.x,
              y: desiredPoint.y
            }
          : node
      ));
      const regions = bubbleCategoryRegions(
        categoryCenterOffset
          ? bubbleCategoryDynamicLayouts(projectedNodes)
          : layouts,
        projectedNodes
      );
      const constrainedPoint = constrainBubbleNodeToCategoryRegions(
        pointer.dragNode,
        regions,
        desiredPoint,
        dragPadding
      );
      if (categoryCenterOffset && singletonLayout) {
        const finalCenterOffset = bubbleCategoryCenterOffsetForNodeDrag(
          pointer.dragNode,
          layouts,
          constrainedPoint,
          dragPadding
        )!;
        pointer.dragNode.categoryCenterOffsetX = finalCenterOffset.x;
        pointer.dragNode.categoryCenterOffsetY = finalCenterOffset.y;
        simulationClientRef.current?.setNodeCategoryCenterOffset(
          pointer.dragNode.id,
          pointer.dragNode.categoryCenterOffsetX,
          pointer.dragNode.categoryCenterOffsetY
        );
      }
      pointer.dragNode.fx = constrainedPoint.x;
      pointer.dragNode.fy = constrainedPoint.y;
      pointer.dragNode.x = pointer.dragNode.fx;
      pointer.dragNode.y = pointer.dragNode.fy;
      const releaseVelocity = bubbleNodeReleaseVelocity(
        dx / viewRef.current.scale,
        dy / viewRef.current.scale,
        elapsed
      );
      pointer.nodeVelocityX = releaseVelocity.x;
      pointer.nodeVelocityY = releaseVelocity.y;
      simulationClientRef.current?.setNodeFixed(pointer.dragNode.id, pointer.dragNode.x, pointer.dragNode.y);
      requestDraw();
      return;
    }

    if (pointer.dragCategory) {
      const worldDx = dx / viewRef.current.scale;
      const worldDy = dy / viewRef.current.scale;
      const translated = translateBubbleCategoryNodesWithPush(
        nodesRef.current.values(),
        pointer.dragCategory,
        worldDx,
        worldDy
      );
      for (const node of translated) {
        simulationClientRef.current?.moveNode(node.id, node.x, node.y);
      }
      if (pointer.dragCategoryTarget) {
        pointer.dragCategoryTarget.centerX += worldDx;
        pointer.dragCategoryTarget.centerY += worldDy;
        simulationClientRef.current?.setCategoryDragTarget({
          ...pointer.dragCategoryTarget,
          nodeIds: [...pointer.dragCategoryTarget.nodeIds]
        });
      }
      requestDraw();
      return;
    }

    viewRef.current.panX += dx;
    viewRef.current.panY += dy;
    panSampleMsRef.current = nextBubblePanSampleMs(panSampleMsRef.current, elapsed);
    panVelocityRef.current = nextBubblePanVelocity(panVelocityRef.current, dx, dy);
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
      simulationClientRef.current?.setNodeFixed(
        pointer.dragNode.id,
        null,
        null,
        0.08,
        pointer.nodeVelocityX,
        pointer.nodeVelocityY
      );
      if (!pointer.moved) {
        const action = graphNodePrimaryAction(pointer.dragNode);
        if (action?.type === "file") openFileRef.current(action.path);
        if (action?.type === "tagSearch") openTagSearchRef.current(action.tag);
      }
    }
    if (pointer.dragCategory) simulationClientRef.current?.setCategoryDragTarget(null);

    if (pointer.type === "pan") {
      panVelocityRef.current = finishBubblePanVelocity(
        panVelocityRef.current,
        panSampleMsRef.current,
        performance.now() - pointer.time
      );
      panSampleMsRef.current = 0;
    }
    pointerRef.current = null;
    event.currentTarget.style.cursor = "grab";
    requestDraw();
  }, [openFileRef, openTagSearchRef, requestDraw, simulationClientRef]);

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
    if (pointer.dragCategory) simulationClientRef.current?.setCategoryDragTarget(null);

    pointerRef.current = null;
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;
    event.currentTarget.style.cursor = "grab";
    requestDraw();
  }, [requestDraw, simulationClientRef]);

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
    const nextScale = clampBubbleScale(viewRef.current.targetScale * Math.pow(1.5, -delta / 120));
    const zoomPoint = bubbleWheelZoomPoint(
      viewRef.current.scale,
      nextScale,
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width || bubbleCanvasSizeFallback.width,
      rect.height || bubbleCanvasSizeFallback.height
    );
    requestBubbleZoom(viewRef.current, zoomPoint.x, zoomPoint.y, nextScale);
    requestDraw();
  }, [requestDraw, viewRef]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;
    requestDraw();

    const keyMap: Partial<Record<string, keyof BubbleKeyboardState>> = {
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

    const keyMap: Partial<Record<string, keyof BubbleKeyboardState>> = {
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
    viewRef.current = initialBubbleViewTransform();
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

function bubbleNodeReleaseVelocity(
  dx: number,
  dy: number,
  elapsedMs: number
): { x: number; y: number } {
  const timeScale = Math.min(1, 16 / Math.max(1, elapsedMs));
  const x = dx * timeScale * 0.28;
  const y = dy * timeScale * 0.28;
  const speed = Math.hypot(x, y);
  if (speed <= 8 || speed === 0) return { x, y };
  return { x: x / speed * 8, y: y / speed * 8 };
}
