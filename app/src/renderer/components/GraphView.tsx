import { relicClient } from "../relicClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";

import type { WorkspaceGraph } from "../../shared/ipc";
import { deriveVisibleGraph } from "../graph/graphDisplayModel";
import { loadWorkspaceGraph } from "../graph/workspaceGraphLoader";
import {
  applyGraphSimulationPositions,
  graphSimulationLinks,
  graphSimulationNodes,
  syncGraphLayout
} from "../graph/graphLayout";
import { createGraphSimulationClient, type GraphSimulationClient } from "../graph/graphSimulationClient";
import {
  defaultGraphDrawTheme,
  defaultGraphOptions,
  type GraphColorGroup,
  type GraphKeyboardState,
  type GraphSimLink,
  type GraphSimNode,
  type GraphViewTransform
} from "../graph/graphTypes";
import { useT } from "../i18n";
import { useLatest } from "../hooks/useLatest";
import { GraphControls } from "./GraphControls";
import {
  animateGraph,
  applyGraphKeyboardNavigation,
  applyGraphKeyboardZoom,
  applyGraphPanInertia,
  applyGraphZoomTransition,
  clampGraphScale,
  drawGraph,
  finishGraphPanVelocity,
  graphNodeAtCanvasPoint,
  graphNodePrimaryAction,
  graphPointerMovedBeyondClickThreshold,
  graphWheelZoomPoint,
  initialGraphViewTransform,
  isGraphNodePrimaryPointerButton,
  moveGraphColorGroup,
  nextGraphPanSampleMs,
  nextGraphPanVelocity,
  requestGraphZoom,
  resolveGraphHoverFocusId,
  shouldContinueGraphFrame,
  stepGraphHighlightState,
  type GraphHighlightState,
  type GraphHoverFocusState
} from "../graph/graphViewModel";
import {
  cancelGraphFrame,
  getCanvas2dContext,
  graphColorGroupsStorageKey,
  graphControlsStorageKey,
  graphOptionsStorageKey,
  graphSectionCollapsedStorageKey,
  loadGraphColorGroups,
  loadGraphControlsOpen,
  loadGraphOptions,
  loadGraphSectionCollapsed,
  nextGroupColor,
  readGraphDrawTheme,
  requestGraphFrameOnce,
  saveJson
} from "../graph/graphViewRuntime";

interface GraphViewProps {
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  refreshRevision?: number;
  workspaceCacheKey?: string;
}

const graphCanvasSizeFallback = { height: 600, width: 900 };
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
    dragNode: GraphSimNode | null;
    lastX: number;
    lastY: number;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    time: number;
    type: "node" | "pan";
  } | null>(null);
  const openFileRef = useLatest(onOpenFile);
  const openTagSearchRef = useLatest(onOpenTagSearch);
  const [controlsOpen, setControlsOpen] = useState(loadGraphControlsOpen);
  const [graphState, setGraphState] = useState<{
    error: string | null;
    graph: WorkspaceGraph | null;
    loading: boolean;
  }>(() => relicClient.current
    ? { error: null, graph: null, loading: true }
    : { error: t("graph.loadFailed"), graph: null, loading: false });
  const [options, setOptions] = useState(loadGraphOptions);
  const [colorGroups, setColorGroups] = useState<GraphColorGroup[]>(loadGraphColorGroups);
  const [draggingColorGroupId, setDraggingColorGroupId] = useState<string | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(loadGraphSectionCollapsed);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const latestOptionsRef = useLatest(options);
  const colorGroupsRef = useLatest(colorGroups);

  const requestDraw = useCallback(() => {
    requestGraphFrameOnce(frameRef, () => drawRef.current());
  }, []);

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

  useEffect(() => {
    let active = true;

    if (!relicClient.current) {
      return () => {
        active = false;
      };
    }

    void loadWorkspaceGraph({ revision: refreshRevision, workspaceId: workspaceCacheKey }).then((result) => {
      if (!active) return;

      if (result.ok) {
        setGraphState({ error: null, graph: result.value, loading: false });
        return;
      }

      setGraphState({ error: result.error.message, graph: null, loading: false });
    }).catch(() => {
      if (!active) return;
      setGraphState({ error: t("graph.loadFailed"), graph: null, loading: false });
    });

    return () => {
      active = false;
    };
  }, [refreshRevision, t, workspaceCacheKey]);

  const filteredGraph = useMemo(() => {
    return deriveVisibleGraph(graphState.graph, options);
  }, [graphState.graph, options.hideUnresolved, options.search, options.showAttachments, options.showOrphans, options.showTags]);

  useEffect(() => {
    saveJson(graphOptionsStorageKey, options);
  }, [options]);

  useEffect(() => {
    saveJson(graphColorGroupsStorageKey, colorGroups);
  }, [colorGroups]);

  useEffect(() => {
    saveJson(graphControlsStorageKey, controlsOpen);
  }, [controlsOpen]);

  useEffect(() => {
    saveJson(graphSectionCollapsedStorageKey, sectionCollapsed);
  }, [sectionCollapsed]);

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

  useEffect(() => {
    simulationClientRef.current?.updateOptions(options);
    requestDraw();
  }, [
    options.centerStrength,
    options.linkDistance,
    options.linkStrength,
    options.nodeSizeMultiplier,
    options.repelStrength,
    requestDraw
  ]);

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
      colorGroupsRef.current,
      filteredGraph.tagsByNode,
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
  }, [filteredGraph.tagsByNode, pinnedNodeId, requestDraw]);

  drawRef.current = draw;

  useEffect(() => {
    requestDraw();
  }, [colorGroups, draw, options, requestDraw]);

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

  const nodeAtPoint = useCallback((clientX: number, clientY: number): GraphSimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
    return graphNodeAtCanvasPoint(
      nodesRef.current.values(),
      point,
      viewRef.current,
      latestOptionsRef.current,
      rect.width || graphCanvasSizeFallback.width,
      rect.height || graphCanvasSizeFallback.height
    );
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.focus();
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;

    const node = nodeAtPoint(event.clientX, event.clientY);
    if (!node && event.button !== 0) return;
    if (node && !isGraphNodePrimaryPointerButton(event.button)) return;

    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    requestDraw();

    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      simulationClientRef.current?.setNodeFixed(node.id, node.x, node.y);
      pointerRef.current = {
        dragNode: node,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        time: performance.now(),
        type: "node"
      };
      return;
    }

    pointerRef.current = {
      dragNode: null,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      time: performance.now(),
      type: "pan"
    };
  }, [nodeAtPoint, requestDraw]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    hoverPointRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

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
      pointer.dragNode.fx = (pointer.dragNode.fx ?? pointer.dragNode.x) + dx / viewRef.current.scale;
      pointer.dragNode.fy = (pointer.dragNode.fy ?? pointer.dragNode.y) + dy / viewRef.current.scale;
      pointer.dragNode.x = pointer.dragNode.fx;
      pointer.dragNode.y = pointer.dragNode.fy;
      simulationClientRef.current?.setNodeFixed(pointer.dragNode.id, pointer.dragNode.x, pointer.dragNode.y);
      requestDraw();
      return;
    }

    viewRef.current.panX += dx;
    viewRef.current.panY += dy;
    panSampleMsRef.current = nextGraphPanSampleMs(panSampleMsRef.current, elapsed);
    panVelocityRef.current = nextGraphPanVelocity(panVelocityRef.current, dx, dy);
    requestDraw();
  }, [requestDraw]);

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

    if (pointer.type === "pan") {
      panVelocityRef.current = finishGraphPanVelocity(panVelocityRef.current, panSampleMsRef.current, performance.now() - pointer.time);
      panSampleMsRef.current = 0;
    }
    pointerRef.current = null;
    event.currentTarget.style.cursor = "grab";
    requestDraw();
  }, [requestDraw]);

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

    pointerRef.current = null;
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;
    event.currentTarget.style.cursor = "grab";
    requestDraw();
  }, [requestDraw]);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    const node = nodeAtPoint(event.clientX, event.clientY);
    setPinnedNodeId(node?.id ?? null);
    requestDraw();
  }, [nodeAtPoint, requestDraw]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
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

    requestGraphZoom(
      viewRef.current,
      zoomPoint.x,
      zoomPoint.y,
      nextScale
    );
    requestDraw();
  }, [requestDraw]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;
    requestDraw();

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      keyboard.left = true;
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      keyboard.right = true;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      keyboard.up = true;
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      keyboard.down = true;
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      keyboard.zoomIn = true;
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      keyboard.zoomOut = true;
    }
  }, [requestDraw]);

  const handleKeyUp = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;
    requestDraw();

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      keyboard.left = false;
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      keyboard.right = false;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      keyboard.up = false;
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      keyboard.down = false;
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      keyboard.zoomIn = false;
      return;
    }
    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      keyboard.zoomOut = false;
    }
  }, [requestDraw]);

  const resetView = useCallback(() => {
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
    setOptions(defaultGraphOptions);
    setColorGroups([]);
    setPinnedNodeId(null);
    requestDraw();
  }, [requestDraw]);

  return (
    <div className="graph-view-shell">
      <canvas
        aria-label={t("graph.canvasLabel")}
        className="graph-view-canvas"
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          hoverPointRef.current = null;
          if (!pointerRef.current && canvasRef.current) canvasRef.current.style.cursor = "grab";
          requestDraw();
        }}
        onPointerMove={handlePointerMove}
        onPointerCancel={handlePointerCancel}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={canvasRef}
        tabIndex={0}
      />
      {graphState.loading ? <div className="graph-view-status">{t("graph.loading")}</div> : null}
      {graphState.error ? (
        <div className="graph-view-status graph-view-status--error">{graphState.error}</div>
      ) : null}
      <GraphControls
        colorGroups={colorGroups}
        controlsOpen={controlsOpen}
        nodeCount={filteredGraph.nodes.length}
        onAddColorGroup={() => setColorGroups((current) => [
          ...current,
          { color: nextGroupColor(current.length), id: `group-${Date.now()}-${current.length}`, query: "" }
        ])}
        onColorGroupChange={(groupId, patch) => setColorGroups((current) =>
          current.map((group) => group.id === groupId ? { ...group, ...patch } : group)
        )}
        onColorGroupDelete={(groupId) => setColorGroups((current) => current.filter((group) => group.id !== groupId))}
        onColorGroupDragEnd={() => setDraggingColorGroupId(null)}
        onColorGroupDragStart={(groupId) => setDraggingColorGroupId(groupId)}
        onColorGroupMove={(targetGroupId) => setColorGroups((current) =>
          draggingColorGroupId ? moveGraphColorGroup(current, draggingColorGroupId, targetGroupId) : current
        )}
        onAnimate={() => {
          animateGraph(nodesRef.current, linksRef.current, viewRef, simulationClientRef.current, latestOptionsRef.current);
          requestDraw();
        }}
        onOptionsChange={(patch) => setOptions((current) => ({ ...current, ...patch }))}
        onReset={resetView}
        onSectionCollapsedChange={(sectionId, collapsed) => setSectionCollapsed((current) => ({
          ...current,
          [sectionId]: collapsed
        }))}
        onToggleControls={() => setControlsOpen((current) => !current)}
        options={options}
        draggingColorGroupId={draggingColorGroupId}
        sectionCollapsed={sectionCollapsed}
        t={t}
      />
    </div>
  );
}
