import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { deriveVisibleGraph } from "../graph/graphDisplayModel";
import {
  applyBubbleSimulationPositions,
  bubbleSimulationLinks,
  bubbleSimulationNodes,
  syncBubbleLayout
} from "../bubble/bubbleLayout";
import { createBubbleSimulationClient, type BubbleSimulationClient } from "../bubble/bubbleSimulationClient";
import {
  defaultBubbleOptions,
  type BubbleSimLink,
  type BubbleSimNode,
  type BubbleViewTransform
} from "../bubble/bubbleTypes";
import {
  defaultGraphDrawTheme,
  graphCategoryColors,
  readGraphDrawTheme
} from "../graph/graphThemeModel";
import { useT } from "../i18n";
import { bubbleCanvasSizeFallback, useBubbleCanvasInteractions } from "../hooks/useBubbleCanvasInteractions";
import { useLatest } from "../hooks/useLatest";
import { useWorkspaceGraphState } from "../hooks/useWorkspaceGraphState";
import {
  applyBubbleKeyboardNavigation,
  applyBubbleKeyboardZoom,
  applyBubblePanInertia,
  applyBubbleZoomTransition,
  drawBubble,
  initialBubbleViewTransform,
  resolveBubbleHoverFocusId,
  shouldContinueBubbleFrame,
  stepBubbleHighlightState
} from "../bubble/bubbleViewModel";
import {
  cancelBubbleFrame,
  getCanvas2dContext,
  requestBubbleFrameOnce
} from "../bubble/bubbleViewRuntime";

interface BubbleViewProps {
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  refreshRevision?: number;
  workspaceCacheKey?: string;
}

export function BubbleView({
  onOpenFile,
  onOpenTagSearch,
  refreshRevision = 0,
  workspaceCacheKey = "current"
}: BubbleViewProps): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const themeRef = useRef(defaultGraphDrawTheme);
  const categoryColorsRef = useRef<ReadonlyMap<string, string>>(new Map());
  const initialNodes = useMemo(() => new Map<string, BubbleSimNode>(), []);
  const initialLinks = useMemo<BubbleSimLink[]>(() => [], []);
  const initialView = useMemo(() => initialBubbleViewTransform(), []);
  const nodesRef = useRef<Map<string, BubbleSimNode>>(initialNodes);
  const linksRef = useRef<BubbleSimLink[]>(initialLinks);
  const viewRef = useRef<BubbleViewTransform>(initialView);
  const simulationClientRef = useRef<BubbleSimulationClient | null>(null);
  const graphState = useWorkspaceGraphState({
    loadFailedMessage: t("bubble.loadFailed"),
    refreshRevision,
    workspaceCacheKey
  });
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeIdState] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const latestOptionsRef = useLatest(defaultBubbleOptions);

  const setSelectedNodeId = useCallback((nodeId: string | null) => {
    selectedNodeIdRef.current = nodeId;
    setSelectedNodeIdState(nodeId);
  }, []);

  const requestDraw = useCallback(() => {
    requestBubbleFrameOnce(frameRef, () => drawRef.current());
  }, []);
  const {
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
    pointerRef
  } = useBubbleCanvasInteractions({
    canvasRef,
    latestOptionsRef,
    nodesRef,
    onOpenFile,
    onOpenTagSearch,
    requestDraw,
    selectedNodeIdRef,
    setSelectedNodeId,
    setPinnedNodeId,
    simulationClientRef,
    viewRef
  });

  const updateTheme = useCallback(() => {
    themeRef.current = readGraphDrawTheme(canvasRef.current ?? document.documentElement);
    categoryColorsRef.current = graphCategoryColors(
      [...nodesRef.current.values()].flatMap((node) =>
        typeof node.category === "string" ? [node.category] : []
      ),
      themeRef.current
    );
    requestDraw();
  }, [requestDraw]);

  useEffect(() => {
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const colorScheme = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const handleColorSchemeChange = () => {
      if (!document.documentElement.hasAttribute("data-theme")) updateTheme();
    };
    colorScheme?.addEventListener("change", handleColorSchemeChange);

    return () => {
      observer.disconnect();
      colorScheme?.removeEventListener("change", handleColorSchemeChange);
    };
  }, [updateTheme]);

  useEffect(() => {
    const client = createBubbleSimulationClient((message) => {
      if (pointerRef.current?.type === "node") return;
      applyBubbleSimulationPositions(nodesRef.current, message);
      requestDraw();
    });
    simulationClientRef.current = client;

    return () => {
      client.dispose();
      simulationClientRef.current = null;
    };
  }, [requestDraw]);

  const filteredGraph = useMemo(() => {
    return deriveVisibleGraph(graphState.graph);
  }, [graphState.graph]);

  useEffect(() => {
    const links = syncBubbleLayout(filteredGraph, nodesRef.current);
    linksRef.current = links;
    categoryColorsRef.current = graphCategoryColors(
      [...nodesRef.current.values()].flatMap((node) =>
        typeof node.category === "string" ? [node.category] : []
      ),
      themeRef.current
    );
    simulationClientRef.current?.sync(
      bubbleSimulationNodes(nodesRef.current.values()),
      bubbleSimulationLinks(links),
      latestOptionsRef.current
    );
    requestDraw();
  }, [filteredGraph, requestDraw]);

  useEffect(() => {
    const currentSelectedNodeId = selectedNodeIdRef.current;
    if (!currentSelectedNodeId || nodesRef.current.has(currentSelectedNodeId)) return;
    setSelectedNodeId(null);
  }, [filteredGraph, setSelectedNodeId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = getCanvas2dContext(canvas);
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const cssWidth = rect.width || bubbleCanvasSizeFallback.width;
    const cssHeight = rect.height || bubbleCanvasSizeFallback.height;
    if (canvas.width !== Math.floor(cssWidth * pixelRatio) || canvas.height !== Math.floor(cssHeight * pixelRatio)) {
      canvas.width = Math.floor(cssWidth * pixelRatio);
      canvas.height = Math.floor(cssHeight * pixelRatio);
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    if (pointerRef.current?.type !== "pan") {
      applyBubblePanInertia(viewRef.current, panVelocityRef.current);
    }
    applyBubbleKeyboardNavigation(viewRef.current, keyboardRef.current);
    applyBubbleKeyboardZoom(viewRef.current, keyboardRef.current, cssWidth, cssHeight);
    applyBubbleZoomTransition(viewRef.current, cssWidth, cssHeight);
    const nodes = [...nodesRef.current.values()];
    const hoverFocusId = pointerRef.current ? null : resolveBubbleHoverFocusId(
      nodesRef.current,
      hoverPointRef.current,
      viewRef.current,
      latestOptionsRef.current,
      cssWidth,
      cssHeight,
      hoverFocusRef.current,
      performance.now()
    );
    const targetHighlightId = pinnedNodeId && nodesRef.current.has(pinnedNodeId)
      ? pinnedNodeId
      : selectedNodeId && nodesRef.current.has(selectedNodeId)
        ? selectedNodeId
        : hoverFocusId;
    const highlight = stepBubbleHighlightState(highlightRef.current, targetHighlightId);
    drawBubble(
      context,
      nodes,
      linksRef.current,
      viewRef.current,
      latestOptionsRef.current,
      highlight,
      themeRef.current,
      categoryColorsRef.current,
      cssWidth,
      cssHeight
    );

    if (shouldContinueBubbleFrame({
      highlight,
      keyboard: keyboardRef.current,
      panVelocity: panVelocityRef.current,
      pointerActive: pointerRef.current !== null,
      targetHighlightId,
      view: viewRef.current
    })) {
      requestDraw();
    }
  }, [pinnedNodeId, requestDraw, selectedNodeId]);

  drawRef.current = draw;

  useEffect(() => {
    requestDraw();
  }, [draw, requestDraw]);

  useEffect(() => {
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(requestDraw);
    if (canvasRef.current) resizeObserver?.observe(canvasRef.current);

    return () => {
      resizeObserver?.disconnect();
    };
  }, [requestDraw]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelBubbleFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  return (
    <div className="bubble-view-shell">
      <canvas
        aria-label={t("bubble.canvasLabel")}
        className="bubble-view-canvas"
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
        onPointerMove={handlePointerMove}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={canvasRef}
        tabIndex={0}
      />
      {graphState.loading ? <div className="chart-view-status">{t("bubble.loading")}</div> : null}
      {graphState.error ? (
        <div className="chart-view-status chart-view-status--error">{graphState.error}</div>
      ) : null}
    </div>
  );
}
