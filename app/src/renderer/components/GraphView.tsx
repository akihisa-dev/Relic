import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { deriveVisibleGraph } from "../graph/graphDisplayModel";
import {
  applyGraphSimulationPositions,
  graphSimulationLinks,
  graphSimulationNodes,
  syncGraphLayout
} from "../graph/graphLayout";
import { createGraphSimulationClient, type GraphSimulationClient } from "../graph/graphSimulationClient";
import {
  defaultGraphOptions,
  defaultGraphDrawTheme,
  type GraphSimLink,
  type GraphSimNode,
  type GraphViewTransform
} from "../graph/graphTypes";
import { useT } from "../i18n";
import { graphCanvasSizeFallback, useGraphCanvasInteractions } from "../hooks/useGraphCanvasInteractions";
import { useLatest } from "../hooks/useLatest";
import { useWorkspaceGraphState } from "../hooks/useWorkspaceGraphState";
import {
  applyGraphKeyboardNavigation,
  applyGraphKeyboardZoom,
  applyGraphPanInertia,
  applyGraphZoomTransition,
  drawGraph,
  initialGraphViewTransform,
  resolveGraphHoverFocusId,
  shouldContinueGraphFrame,
  stepGraphHighlightState
} from "../graph/graphViewModel";
import {
  cancelGraphFrame,
  getCanvas2dContext,
  readGraphDrawTheme,
  requestGraphFrameOnce
} from "../graph/graphViewRuntime";

interface GraphViewProps {
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  refreshRevision?: number;
  workspaceCacheKey?: string;
}

export function GraphView({
  onOpenFile,
  onOpenTagSearch,
  refreshRevision = 0,
  workspaceCacheKey = "current"
}: GraphViewProps): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawRef = useRef<() => void>(() => undefined);
  const themeRef = useRef(defaultGraphDrawTheme);
  const initialNodes = useMemo(() => new Map<string, GraphSimNode>(), []);
  const initialLinks = useMemo<GraphSimLink[]>(() => [], []);
  const initialView = useMemo(() => initialGraphViewTransform(), []);
  const nodesRef = useRef<Map<string, GraphSimNode>>(initialNodes);
  const linksRef = useRef<GraphSimLink[]>(initialLinks);
  const viewRef = useRef<GraphViewTransform>(initialView);
  const simulationClientRef = useRef<GraphSimulationClient | null>(null);
  const graphState = useWorkspaceGraphState({
    loadFailedMessage: t("graph.loadFailed"),
    refreshRevision,
    workspaceCacheKey
  });
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const latestOptionsRef = useLatest(defaultGraphOptions);

  const requestDraw = useCallback(() => {
    requestGraphFrameOnce(frameRef, () => drawRef.current());
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
  } = useGraphCanvasInteractions({
    canvasRef,
    latestOptionsRef,
    nodesRef,
    onOpenFile,
    onOpenTagSearch,
    requestDraw,
    setPinnedNodeId,
    simulationClientRef,
    viewRef
  });

  const updateTheme = useCallback(() => {
    themeRef.current = readGraphDrawTheme(canvasRef.current ?? document.documentElement);
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
    const client = createGraphSimulationClient((message) => {
      applyGraphSimulationPositions(nodesRef.current, message);
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
    const links = syncGraphLayout(filteredGraph, nodesRef.current);
    linksRef.current = links;
    simulationClientRef.current?.sync(
      graphSimulationNodes(nodesRef.current.values()),
      graphSimulationLinks(links),
      latestOptionsRef.current
    );
    requestDraw();
  }, [filteredGraph, requestDraw]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = getCanvas2dContext(canvas);
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const cssWidth = rect.width || graphCanvasSizeFallback.width;
    const cssHeight = rect.height || graphCanvasSizeFallback.height;
    if (canvas.width !== Math.floor(cssWidth * pixelRatio) || canvas.height !== Math.floor(cssHeight * pixelRatio)) {
      canvas.width = Math.floor(cssWidth * pixelRatio);
      canvas.height = Math.floor(cssHeight * pixelRatio);
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    if (pointerRef.current?.type !== "pan") {
      applyGraphPanInertia(viewRef.current, panVelocityRef.current);
    }
    applyGraphKeyboardNavigation(viewRef.current, keyboardRef.current);
    applyGraphKeyboardZoom(viewRef.current, keyboardRef.current, cssWidth, cssHeight);
    applyGraphZoomTransition(viewRef.current, cssWidth, cssHeight);
    const nodes = [...nodesRef.current.values()];
    const hoverFocusId = pointerRef.current ? null : resolveGraphHoverFocusId(
      nodesRef.current,
      hoverPointRef.current,
      viewRef.current,
      latestOptionsRef.current,
      cssWidth,
      cssHeight,
      hoverFocusRef.current,
      performance.now()
    );
    const targetHighlightId = pinnedNodeId && nodesRef.current.has(pinnedNodeId) ? pinnedNodeId : hoverFocusId;
    const highlight = stepGraphHighlightState(highlightRef.current, targetHighlightId);
    drawGraph(
      context,
      nodes,
      linksRef.current,
      viewRef.current,
      latestOptionsRef.current,
      highlight,
      themeRef.current,
      cssWidth,
      cssHeight
    );

    if (shouldContinueGraphFrame({
      highlight,
      keyboard: keyboardRef.current,
      panVelocity: panVelocityRef.current,
      pointerActive: pointerRef.current !== null,
      targetHighlightId,
      view: viewRef.current
    })) {
      requestDraw();
    }
  }, [pinnedNodeId, requestDraw]);

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
    if (frameRef.current !== null) cancelGraphFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  return (
    <div className="graph-view-shell">
      <canvas
        aria-label={t("graph.canvasLabel")}
        className="graph-view-canvas"
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
      {graphState.loading ? <div className="graph-view-status">{t("graph.loading")}</div> : null}
      {graphState.error ? (
        <div className="graph-view-status graph-view-status--error">{graphState.error}</div>
      ) : null}
    </div>
  );
}
