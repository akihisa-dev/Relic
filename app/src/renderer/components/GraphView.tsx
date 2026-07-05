import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";

import type { WorkspaceGraph, WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import { useT } from "../i18n";
import type { Translator } from "../i18nModel";

interface GraphViewProps {
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
}

interface GraphOptions {
  centerStrength: number;
  hideUnresolved: boolean;
  lineSizeMultiplier: number;
  linkDistance: number;
  linkStrength: number;
  nodeSizeMultiplier: number;
  repelStrength: number;
  search: string;
  showArrows: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  showTags: boolean;
  textFadeMultiplier: number;
}

interface SimNode extends WorkspaceGraphNode {
  fx: number | null;
  fy: number | null;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

interface SimLink extends WorkspaceGraphLink {
  sourceNode: SimNode;
  targetNode: SimNode;
}

interface GraphKeyboardState {
  down: boolean;
  left: boolean;
  right: boolean;
  shift: boolean;
  up: boolean;
  zoomIn: boolean;
  zoomOut: boolean;
}

interface GraphViewTransform {
  panX: number;
  panY: number;
  scale: number;
  targetScale: number;
  zoomCenterX: number;
  zoomCenterY: number;
}

type GraphNodePrimaryAction =
  | { path: string; type: "file" }
  | { tag: string; type: "tagSearch" };

type GraphLinkEndpointNode = Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount"> & {
  x: number;
  y: number;
};

interface GraphColorGroup {
  color: string;
  id: string;
  query: string;
}

type GraphControlSectionId = "display" | "filter" | "forces" | "groups";
type GraphSectionCollapsedState = Record<GraphControlSectionId, boolean>;

const defaultGraphOptions: GraphOptions = {
  centerStrength: 0.1,
  hideUnresolved: false,
  lineSizeMultiplier: 1,
  linkDistance: 250,
  linkStrength: 1,
  nodeSizeMultiplier: 1,
  repelStrength: 10,
  search: "",
  showArrows: false,
  showAttachments: false,
  showOrphans: true,
  showTags: false,
  textFadeMultiplier: 0
};

const graphCanvasSizeFallback = { height: 600, width: 900 };
const graphOptionsStorageKey = "relic.graphView.options.v1";
const graphControlsStorageKey = "relic.graphView.controlsOpen.v1";
const graphColorGroupsStorageKey = "relic.graphView.colorGroups.v1";
const graphSectionCollapsedStorageKey = "relic.graphView.sectionCollapsed.v1";
const graphMinScale = 1 / 128;
const graphMaxScale = 8;
const graphNodeClickMovementThresholdSq = 25;
const defaultGraphSectionCollapsed: GraphSectionCollapsedState = {
  display: true,
  filter: true,
  forces: true,
  groups: true
};

function initialGraphViewTransform(): GraphViewTransform {
  return {
    panX: 0,
    panY: 0,
    scale: 1,
    targetScale: 1,
    zoomCenterX: 0,
    zoomCenterY: 0
  };
}

export function GraphView({ onOpenFile, onOpenTagSearch }: GraphViewProps): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const initialNodes = useMemo(() => new Map<string, SimNode>(), []);
  const initialLinks = useMemo<SimLink[]>(() => [], []);
  const initialView = useMemo(() => initialGraphViewTransform(), []);
  const nodesRef = useRef<Map<string, SimNode>>(initialNodes);
  const linksRef = useRef<SimLink[]>(initialLinks);
  const viewRef = useRef<GraphViewTransform>(initialView);
  const panVelocityRef = useRef({ x: 0, y: 0 });
  const panSampleMsRef = useRef(0);
  const hoverPointRef = useRef<{ x: number; y: number } | null>(null);
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
    dragNode: SimNode | null;
    lastX: number;
    lastY: number;
    moved: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    time: number;
    type: "node" | "pan";
  } | null>(null);
  const latestOptionsRef = useRef(defaultGraphOptions);
  const colorGroupsRef = useRef<GraphColorGroup[]>([]);
  const openFileRef = useRef(onOpenFile);
  const openTagSearchRef = useRef(onOpenTagSearch);
  const [controlsOpen, setControlsOpen] = useState(loadGraphControlsOpen);
  const [graphState, setGraphState] = useState<{
    error: string | null;
    graph: WorkspaceGraph | null;
    loading: boolean;
  }>(() => window.relic
    ? { error: null, graph: null, loading: true }
    : { error: t("graph.loadFailed"), graph: null, loading: false });
  const [options, setOptions] = useState(loadGraphOptions);
  const [colorGroups, setColorGroups] = useState<GraphColorGroup[]>(loadGraphColorGroups);
  const [draggingColorGroupId, setDraggingColorGroupId] = useState<string | null>(null);
  const [sectionCollapsed, setSectionCollapsed] = useState(loadGraphSectionCollapsed);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);

  openFileRef.current = onOpenFile;
  openTagSearchRef.current = onOpenTagSearch;
  latestOptionsRef.current = options;
  colorGroupsRef.current = colorGroups;

  useEffect(() => {
    let active = true;

    if (!window.relic) {
      return () => {
        active = false;
      };
    }

    void window.relic.getWorkspaceGraph().then((result) => {
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
  }, [t]);

  const filteredGraph = useMemo(() => {
    const graph = graphState.graph ?? { links: [], nodes: [] };
    const tagsByNode = collectGraphNodeTags(graph.nodes, graph.links);
    const linkedIds = new Set<string>();

    for (const link of graph.links) {
      linkedIds.add(link.source);
      linkedIds.add(link.target);
    }

    const nodeIds = new Set<string>();
    for (const node of graph.nodes) {
      if (!options.showTags && node.type === "tag") continue;
      if (!options.showAttachments && node.type === "attachment") continue;
      if (options.hideUnresolved && node.type === "unresolved") continue;
      if (!options.showOrphans && !linkedIds.has(node.id)) continue;
      if (!graphNodeMatchesQuery(node, options.search, tagsByNode.get(node.id) ?? [])) continue;

      nodeIds.add(node.id);
    }
    const links = graph.links.filter((link) =>
      nodeIds.has(link.source) &&
      nodeIds.has(link.target) &&
      (options.showTags || link.type !== "tag")
    );
    const connectedIds = new Set<string>();
    for (const link of links) {
      connectedIds.add(link.source);
      connectedIds.add(link.target);
    }

    return {
      links,
      nodes: graph.nodes.filter((node) =>
        nodeIds.has(node.id) &&
        (options.showOrphans || connectedIds.has(node.id))
      ),
      tagsByNode
    };
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
    syncSimulation(filteredGraph, nodesRef.current, linksRef);
  }, [filteredGraph]);

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
    stepSimulation(nodesRef.current, linksRef.current, latestOptionsRef.current, cssWidth, cssHeight);
    const hoveredNode = hoveredNodeId ? nodesRef.current.get(hoveredNodeId) ?? null : null;
    if (
      !pinnedNodeId &&
      hoveredNode &&
      !graphHoveredNodeContainsPoint(
        hoveredNode,
        hoverPointRef.current,
        viewRef.current,
        latestOptionsRef.current,
        cssWidth,
        cssHeight
      )
    ) {
      setHoveredNodeId(null);
    }
    drawGraph(
      context,
      [...nodesRef.current.values()],
      linksRef.current,
      viewRef.current,
      latestOptionsRef.current,
      colorGroupsRef.current,
      filteredGraph.tagsByNode,
      pinnedNodeId ?? hoveredNodeId,
      cssWidth,
      cssHeight
    );

    frameRef.current = requestGraphFrame(draw);
  }, [filteredGraph.tagsByNode, hoveredNodeId, pinnedNodeId]);

  useEffect(() => {
    frameRef.current = requestGraphFrame(draw);

    return () => {
      if (frameRef.current !== null) cancelGraphFrame(frameRef.current);
    };
  }, [draw]);

  const nodeAtPoint = useCallback((clientX: number, clientY: number): SimNode | null => {
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
    const nodes = [...nodesRef.current.values()].toReversed();

    for (const node of nodes) {
      if (distance(point.x, point.y, node.x, node.y) <= graphNodeVisualRadius(node, latestOptionsRef.current, viewRef.current.scale) + 4 / viewRef.current.scale) {
        return node;
      }
    }

    return null;
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

    if (node) {
      node.fx = node.x;
      node.fy = node.y;
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
  }, [nodeAtPoint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    hoverPointRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    const pointer = pointerRef.current;
    if (!pointer) {
      const node = nodeAtPoint(event.clientX, event.clientY);
      setHoveredNodeId(node?.id ?? null);
      return;
    }

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
      return;
    }

    viewRef.current.panX += dx;
    viewRef.current.panY += dy;
    panSampleMsRef.current = nextGraphPanSampleMs(panSampleMsRef.current, elapsed);
    panVelocityRef.current = nextGraphPanVelocity(panVelocityRef.current, dx, dy);
  }, [nodeAtPoint]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;

    event.currentTarget.releasePointerCapture(pointer.pointerId);
    if (pointer.dragNode) {
      pointer.dragNode.fx = null;
      pointer.dragNode.fy = null;
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
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.focus();
    const node = nodeAtPoint(event.clientX, event.clientY);
    setPinnedNodeId(node?.id ?? null);
  }, [nodeAtPoint]);

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
  }, []);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;

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
  }, []);

  const handleKeyUp = useCallback((event: ReactKeyboardEvent<HTMLCanvasElement>) => {
    const keyboard = keyboardRef.current;
    keyboard.shift = event.shiftKey;

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
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = initialGraphViewTransform();
    panVelocityRef.current = { x: 0, y: 0 };
    panSampleMsRef.current = 0;
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
        onPointerLeave={() => {
          hoverPointRef.current = null;
          setHoveredNodeId(null);
        }}
        onPointerMove={handlePointerMove}
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
        onAnimate={() => animateGraph(nodesRef.current, viewRef)}
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

function GraphControls({
  colorGroups,
  controlsOpen,
  draggingColorGroupId,
  nodeCount,
  onAddColorGroup,
  onAnimate,
  onColorGroupChange,
  onColorGroupDelete,
  onColorGroupDragEnd,
  onColorGroupDragStart,
  onColorGroupMove,
  onOptionsChange,
  onReset,
  onSectionCollapsedChange,
  onToggleControls,
  options,
  sectionCollapsed,
  t
}: {
  colorGroups: GraphColorGroup[];
  controlsOpen: boolean;
  draggingColorGroupId: string | null;
  nodeCount: number;
  onAddColorGroup: () => void;
  onAnimate: () => void;
  onColorGroupChange: (groupId: string, patch: Partial<GraphColorGroup>) => void;
  onColorGroupDelete: (groupId: string) => void;
  onColorGroupDragEnd: () => void;
  onColorGroupDragStart: (groupId: string) => void;
  onColorGroupMove: (targetGroupId: string) => void;
  onOptionsChange: (patch: Partial<GraphOptions>) => void;
  onReset: () => void;
  onSectionCollapsedChange: (sectionId: GraphControlSectionId, collapsed: boolean) => void;
  onToggleControls: () => void;
  options: GraphOptions;
  sectionCollapsed: GraphSectionCollapsedState;
  t: Translator;
}): ReactElement {
  return (
    <aside className={`graph-controls${controlsOpen ? "" : " is-close"}`} data-ignore-swipe="true">
      <button
        aria-label={controlsOpen ? t("graph.closeSettings") : t("graph.openSettings")}
        className={`graph-controls-button ${controlsOpen ? "mod-close" : "mod-open"}`}
        onClick={onToggleControls}
        title={controlsOpen ? t("graph.close") : t("graph.open")}
        type="button"
      >
        {controlsOpen ? <GraphControlIcon name="close" /> : <GraphControlIcon name="settings" />}
      </button>
      <button
        aria-label={t("graph.playTimelapseAria")}
        className="graph-controls-button mod-animate"
        onClick={onAnimate}
        title={t("graph.playTimelapse")}
        type="button"
      >
        <GraphControlIcon name="wand" />
      </button>
      <button
        aria-label={t("graph.resetSettings")}
        className="graph-controls-button mod-reset"
        onClick={onReset}
        title={t("graph.resetToDefaults")}
        type="button"
      >
        <GraphControlIcon name="reset" />
      </button>
      <GraphControlSection
        collapsed={sectionCollapsed.filter}
        id="filter"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.filters")}
      >
        <input
          aria-label={t("graph.filterNodes")}
          className="graph-search-input"
          onChange={(event) => onOptionsChange({ search: event.target.value })}
          placeholder={t("graph.searchNodesPlaceholder")}
          type="search"
          value={options.search}
        />
        <GraphToggle label={t("graph.tags")} onChange={(showTags) => onOptionsChange({ showTags })} value={options.showTags} />
        <GraphToggle
          label={t("graph.attachments")}
          onChange={(showAttachments) => onOptionsChange({ showAttachments })}
          value={options.showAttachments}
        />
        <GraphToggle
          label={t("graph.existingFilesOnly")}
          onChange={(hideUnresolved) => onOptionsChange({ hideUnresolved })}
          value={options.hideUnresolved}
        />
        <GraphToggle label={t("graph.orphans")} onChange={(showOrphans) => onOptionsChange({ showOrphans })} value={options.showOrphans} />
      </GraphControlSection>
      <GraphControlSection
        collapsed={sectionCollapsed.groups}
        id="groups"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.groups")}
      >
        <div className="graph-color-groups-container">
          {colorGroups.map((group) => (
            <div
              className={`graph-color-group${draggingColorGroupId === group.id ? " is-dragging" : ""}`}
              key={group.id}
              onDragOver={(event) => {
                event.preventDefault();
                onColorGroupMove(group.id);
              }}
            >
              <button
                aria-label={t("graph.reorderGroup")}
                className="graph-color-group-drag"
                draggable
                onDragEnd={onColorGroupDragEnd}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", group.id);
                  onColorGroupDragStart(group.id);
                }}
                title={t("graph.dragToReorder")}
                type="button"
              >
                <GraphControlIcon name="grip" />
              </button>
              <input
                aria-label={t("graph.groupQuery")}
                onChange={(event) => onColorGroupChange(group.id, { query: event.target.value })}
                placeholder={t("graph.groupQueryPlaceholder")}
                type="text"
                value={group.query}
              />
              <input
                aria-label={t("graph.groupColor")}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onColorGroupChange(group.id, { color: event.target.value })}
                type="color"
                value={group.color}
              />
              <button aria-label={t("graph.deleteGroup")} onClick={() => onColorGroupDelete(group.id)} type="button">
                <GraphControlIcon name="trash" />
              </button>
            </div>
          ))}
        </div>
        <button className="graph-cta-button" onClick={onAddColorGroup} type="button">{t("graph.newGroup")}</button>
      </GraphControlSection>
      <GraphControlSection
        collapsed={sectionCollapsed.display}
        id="display"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.display")}
      >
        <GraphToggle label={t("graph.arrows")} onChange={(showArrows) => onOptionsChange({ showArrows })} value={options.showArrows} />
        <GraphSlider label={t("graph.textFadeThreshold")} max={3} min={-3} onChange={(textFadeMultiplier) => onOptionsChange({ textFadeMultiplier })} step={0.1} value={options.textFadeMultiplier} />
        <GraphSlider label={t("graph.nodeSize")} max={5} min={0.1} onChange={(nodeSizeMultiplier) => onOptionsChange({ nodeSizeMultiplier })} step={0.1} value={options.nodeSizeMultiplier} />
        <GraphSlider label={t("graph.linkThickness")} max={5} min={0.1} onChange={(lineSizeMultiplier) => onOptionsChange({ lineSizeMultiplier })} step={0.1} value={options.lineSizeMultiplier} />
        <button className="graph-cta-button" onClick={onAnimate} type="button">{t("graph.animateTimelapse")}</button>
      </GraphControlSection>
      <GraphControlSection
        collapsed={sectionCollapsed.forces}
        id="forces"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.forces")}
      >
        <GraphSlider label={t("graph.centerForce")} max={1} min={0} onChange={(centerStrength) => onOptionsChange({ centerStrength })} step={0.01} value={options.centerStrength} />
        <GraphSlider label={t("graph.repelForce")} max={20} min={0} onChange={(repelStrength) => onOptionsChange({ repelStrength })} step={0.1} value={options.repelStrength} />
        <GraphSlider label={t("graph.linkForce")} max={1} min={0} onChange={(linkStrength) => onOptionsChange({ linkStrength })} step={0.01} value={options.linkStrength} />
        <GraphSlider label={t("graph.linkDistance")} max={500} min={30} onChange={(linkDistance) => onOptionsChange({ linkDistance })} step={1} value={options.linkDistance} />
      </GraphControlSection>
      <div className="graph-control-count">{t("graph.nodeCount", { count: nodeCount })}</div>
    </aside>
  );
}

function GraphControlIcon({ name }: { name: "close" | "grip" | "reset" | "settings" | "trash" | "triangle" | "wand" }): ReactElement {
  if (name === "grip") {
    return (
      <svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    );
  }

  if (name === "triangle") {
    return (
      <svg aria-hidden="true" fill="currentColor" height="12" viewBox="0 0 24 24" width="12">
        <path d="M9 6l6 6-6 6z" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (name === "reset") {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <path d="M3 12a9 9 0 1 0 3-6.708" />
        <path d="M3 3v6h6" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    );
  }

  if (name === "wand") {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <path d="M15 4V2" />
        <path d="M15 16v-2" />
        <path d="M8 9H6" />
        <path d="M20 9h-2" />
        <path d="m17.8 6.2 1.4-1.4" />
        <path d="m10.8 13.2-1.4 1.4" />
        <path d="m10.8 4.8-1.4-1.4" />
        <path d="m17.8 11.8 1.4 1.4" />
        <path d="m3 21 9-9" />
        <path d="m12 12 3-3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function GraphControlSection({
  children,
  collapsed,
  id,
  onCollapsedChange,
  title
}: {
  children: React.ReactNode;
  collapsed: boolean;
  id: GraphControlSectionId;
  onCollapsedChange: (sectionId: GraphControlSectionId, collapsed: boolean) => void;
  title: string;
}): ReactElement {
  return (
    <section className={`graph-control-section mod-${id}${collapsed ? " is-collapsed" : ""}`}>
      <button
        aria-expanded={!collapsed}
        className="graph-control-section-header"
        onClick={() => onCollapsedChange(id, !collapsed)}
        type="button"
      >
        <span className="graph-control-section-icon">
          <GraphControlIcon name="triangle" />
        </span>
        <span>{title}</span>
      </button>
      <div className="graph-control-section-children" hidden={collapsed}>{children}</div>
    </section>
  );
}

function GraphToggle({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: boolean }): ReactElement {
  return (
    <label className="graph-setting-item graph-setting-item--toggle">
      <span>{label}</span>
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function GraphSlider({
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}): ReactElement {
  return (
    <label className="graph-setting-item graph-setting-item--slider">
      <span>{label}</span>
      <input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    </label>
  );
}

function syncSimulation(
  graph: WorkspaceGraph,
  nodes: Map<string, SimNode>,
  linksRef: React.MutableRefObject<SimLink[]>
): void {
  const nextIds = new Set(graph.nodes.map((node) => node.id));

  for (const id of nodes.keys()) {
    if (!nextIds.has(id)) nodes.delete(id);
  }

  graph.nodes.forEach((node, index) => {
    if (nodes.has(node.id)) {
      Object.assign(nodes.get(node.id)!, node);
      return;
    }

    const angle = index * 2.399963229728653;
    const radius = 80 + 9 * Math.sqrt(index);
    nodes.set(node.id, {
      ...node,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  });

  linksRef.current = graph.links.flatMap((link) => {
    const sourceNode = nodes.get(link.source);
    const targetNode = nodes.get(link.target);
    return sourceNode && targetNode ? [{ ...link, sourceNode, targetNode }] : [];
  });
}

function animateGraph(
  nodes: Map<string, SimNode>,
  viewRef: React.MutableRefObject<GraphViewTransform>
): void {
  viewRef.current = initialGraphViewTransform();
  let index = 0;

  for (const node of nodes.values()) {
    const angle = index * 2.399963229728653;
    const radius = 18 + Math.sqrt(index) * 4;
    node.fx = null;
    node.fy = null;
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
    node.vx = Math.cos(angle) * 3.2;
    node.vy = Math.sin(angle) * 3.2;
    index += 1;
  }
}

function moveGraphColorGroup(
  groups: GraphColorGroup[],
  draggingGroupId: string,
  targetGroupId: string
): GraphColorGroup[] {
  if (draggingGroupId === targetGroupId) return groups;

  const from = groups.findIndex((group) => group.id === draggingGroupId);
  const to = groups.findIndex((group) => group.id === targetGroupId);
  if (from < 0 || to < 0) return groups;

  const next = [...groups];
  const [moved] = next.splice(from, 1);
  if (!moved) return groups;
  next.splice(to, 0, moved);

  return next;
}

function stepSimulation(
  nodes: Map<string, SimNode>,
  links: SimLink[],
  options: GraphOptions,
  width: number,
  height: number
): void {
  const nodeList = [...nodes.values()];
  const centerX = width / 2;
  const centerY = height / 2;

  for (const node of nodeList) {
    node.vx += (-node.x) * options.centerStrength * 0.002;
    node.vy += (-node.y) * options.centerStrength * 0.002;
  }

  for (const link of links) {
    const source = link.sourceNode;
    const target = link.targetNode;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const strength = (length - options.linkDistance) / length * options.linkStrength * 0.002;
    const fx = dx * strength;
    const fy = dy * strength;
    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  for (let i = 0; i < nodeList.length; i += 1) {
    for (let j = i + 1; j < nodeList.length; j += 1) {
      const a = nodeList[i];
      const b = nodeList[j];
      const dx = b.x - a.x || 0.01;
      const dy = b.y - a.y || 0.01;
      const distanceSq = Math.max(64, dx * dx + dy * dy);
      const repel = Math.pow(options.repelStrength, 3);
      const force = Math.min(2.4, repel * 0.08 / distanceSq);
      const length = Math.sqrt(distanceSq);
      const fx = dx / length * force;
      const fy = dy / length * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  for (const node of nodeList) {
    if (node.fx !== null && node.fy !== null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;
    node.x = clamp(node.x, -centerX * 4, centerX * 4);
    node.y = clamp(node.y, -centerY * 4, centerY * 4);
  }
}

function drawGraph(
  context: CanvasRenderingContext2D,
  nodes: SimNode[],
  links: SimLink[],
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  colorGroups: GraphColorGroup[],
  tagsByNode: Map<string, string[]>,
  hoveredNodeId: string | null,
  width: number,
  height: number
): void {
  context.save();
  context.translate(view.panX + width / 2, view.panY + height / 2);
  context.scale(view.scale, view.scale);

  const focused = hoveredNodeId ? nodes.find((node) => node.id === hoveredNodeId) ?? null : null;
  const neighbors = new Set<string>();
  if (focused) {
    for (const link of links) {
      if (link.source === focused.id) neighbors.add(link.target);
      if (link.target === focused.id) neighbors.add(link.source);
    }
  }

  const linkScaleOpacity = graphLinkScaleOpacity(view.scale);
  for (const link of links) {
    const endpoints = graphLinkEndpoints(link.sourceNode, link.targetNode, options, view.scale);
    if (!endpoints.visible) continue;

    const active = !focused || link.source === focused.id || link.target === focused.id;
    context.globalAlpha = (active ? 0.65 : 0.12) * linkScaleOpacity;
    context.strokeStyle = active ? cssVar("--color-border-strong", "#9a9a9a") : cssVar("--color-border", "#dedede");
    context.lineWidth = Math.max(0.4 / view.scale, options.lineSizeMultiplier * Math.sqrt(link.count) / view.scale);
    context.beginPath();
    context.moveTo(endpoints.sourceX, endpoints.sourceY);
    context.lineTo(endpoints.targetX, endpoints.targetY);
    context.stroke();

    if (options.showArrows && linkScaleOpacity > 0.001) {
      drawArrow(context, link.sourceNode, link.targetNode, options, view.scale);
    }
  }

  context.globalAlpha = 1;
  for (const node of nodes) {
    const active = !focused || node.id === focused.id || neighbors.has(node.id);
    const radius = graphNodeVisualRadius(node, options, view.scale);
    const color = nodeColor(node, colorGroups, tagsByNode.get(node.id) ?? [], node.id === focused?.id);
    context.globalAlpha = active ? 1 : 0.22;
    context.fillStyle = color;
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fill();

    if (node.id === focused?.id) {
      context.strokeStyle = cssVar("--color-primary", "#2f66b1");
      context.lineWidth = 2 / view.scale;
      context.beginPath();
      context.arc(node.x, node.y, radius + Math.max(2, 5 / view.scale), 0, Math.PI * 2);
      context.stroke();
    }

    const labelAlpha = graphLabelOpacity(view.scale, options.textFadeMultiplier);
    if (labelAlpha > 0.02) {
      context.globalAlpha = (active ? 1 : 0.2) * labelAlpha;
      context.fillStyle = cssVar("--color-text", "#1e1e1e");
      const labelScale = node.id === focused?.id && view.scale < 1 ? 1 / view.scale : graphNodeScale(view.scale);
      context.font = `${Math.max(10 / view.scale, 13 * labelScale)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(node.label, node.x, node.y + radius + 4 / view.scale, 240 / view.scale);
    }
  }
  context.restore();
}

export function graphLinkEndpoints(
  source: GraphLinkEndpointNode,
  target: GraphLinkEndpointNode,
  options: GraphOptions,
  scale: number
): {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  visible: boolean;
} {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const sourceRadius = graphNodeVisualRadius(source, options, scale);
  const targetRadius = graphNodeVisualRadius(target, options, scale);

  if (length <= sourceRadius + targetRadius) {
    return {
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      visible: false
    };
  }

  const unitX = dx / length;
  const unitY = dy / length;

  return {
    sourceX: source.x + unitX * sourceRadius,
    sourceY: source.y + unitY * sourceRadius,
    targetX: target.x - unitX * targetRadius,
    targetY: target.y - unitY * targetRadius,
    visible: true
  };
}

function drawArrow(context: CanvasRenderingContext2D, source: SimNode, target: SimNode, options: GraphOptions, scale = 1): void {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = graphNodeVisualRadius(target, options, scale) + 3 / scale;
  const x = target.x - Math.cos(angle) * radius;
  const y = target.y - Math.sin(angle) * radius;
  const size = 6 / scale;

  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - Math.cos(angle - 0.45) * size, y - Math.sin(angle - 0.45) * size);
  context.lineTo(x - Math.cos(angle + 0.45) * size, y - Math.sin(angle + 0.45) * size);
  context.closePath();
  context.fillStyle = context.strokeStyle;
  context.fill();
}

export function graphNodeBaseRadius(node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount">, options: GraphOptions): number {
  const weight = node.backlinkCount + node.linkCount;

  return options.nodeSizeMultiplier * Math.max(8, Math.min(3 * Math.sqrt(weight + 1), 30));
}

export function graphNodeScale(scale: number): number {
  return Math.sqrt(1 / Math.max(graphMinScale, scale));
}

export function graphLinkScaleOpacity(scale: number): number {
  return clamp(2 * (scale - 0.3), 0, 1);
}

function graphNodeVisualRadius(
  node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount">,
  options: GraphOptions,
  scale: number
): number {
  return graphNodeBaseRadius(node, options) * graphNodeScale(scale);
}

function nodeColor(node: WorkspaceGraphNode, groups: GraphColorGroup[], tags: string[], focused: boolean): string {
  if (focused) return cssVar("--color-primary", "#2f66b1");

  const group = groups.find((candidate) => graphNodeMatchesQuery(node, candidate.query, tags));
  if (group) return group.color;

  if (node.type === "tag") return cssVar("--color-accent", "#3c8f6d");
  if (node.type === "attachment") return cssVar("--color-primary-muted", "#6f8fc8");
  if (node.type === "unresolved") return cssVar("--color-text-muted", "#9a9a9a");

  return cssVar("--color-text-secondary", "#5f646d");
}

function collectGraphNodeTags(
  nodes: WorkspaceGraphNode[],
  links: WorkspaceGraphLink[]
): Map<string, string[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const tagsByNode = new Map<string, Set<string>>();

  for (const link of links) {
    if (link.type !== "tag") continue;
    const tagNode = nodeById.get(link.target);
    if (!tagNode || tagNode.type !== "tag") continue;
    const tag = tagNode.label.replace(/^#/, "");
    const tags = tagsByNode.get(link.source) ?? new Set<string>();
    tags.add(tag);
    tagsByNode.set(link.source, tags);
  }

  return new Map([...tagsByNode.entries()].map(([nodeId, tags]) => [
    nodeId,
    [...tags].toSorted((a, b) => a.localeCompare(b, "ja"))
  ]));
}

function graphNodeMatchesQuery(node: WorkspaceGraphNode, query: string, tags: string[]): boolean {
  const tokens = tokenizeGraphQuery(query);
  if (tokens.length === 0) return true;

  return tokens.every((rawToken) => {
    const negated = rawToken.startsWith("-");
    const token = (negated ? rawToken.slice(1) : rawToken).trim().toLocaleLowerCase();
    if (!token) return true;

    const matches = graphNodeMatchesToken(node, token, tags);
    return negated ? !matches : matches;
  });
}

function graphNodeMatchesToken(node: WorkspaceGraphNode, token: string, tags: string[]): boolean {
  const separatorIndex = token.indexOf(":");
  if (separatorIndex > 0) {
    const key = token.slice(0, separatorIndex);
    const value = token.slice(separatorIndex + 1);
    if (!value) return false;

    if (key === "path") return (node.path ?? node.id).toLocaleLowerCase().includes(value);
    if (key === "file" || key === "name") return node.label.toLocaleLowerCase().includes(value);
    if (key === "tag") return graphNodeTagSearchText(node, tags).includes(value.replace(/^#/, ""));
    if (key === "type" || key === "is") return node.type.toLocaleLowerCase() === value;
  }

  return graphNodeSearchText(node, tags).includes(token);
}

function graphNodeSearchText(node: WorkspaceGraphNode, tags: string[]): string {
  return [
    node.label,
    node.path ?? "",
    node.id,
    node.type,
    ...tags.map((tag) => `#${tag}`)
  ].join("\n").toLocaleLowerCase();
}

function graphNodeTagSearchText(node: WorkspaceGraphNode, tags: string[]): string {
  return [
    node.type === "tag" ? node.label.replace(/^#/, "") : "",
    ...tags
  ].join("\n").toLocaleLowerCase();
}

function tagSearchQueryFromNode(node: WorkspaceGraphNode): string {
  return node.label.replace(/^#/, "") || node.id.replace(/^#/, "");
}

export function graphNodePrimaryAction(node: WorkspaceGraphNode): GraphNodePrimaryAction | null {
  if (node.path) return { path: node.path, type: "file" };
  if (node.type === "tag") return { tag: tagSearchQueryFromNode(node), type: "tagSearch" };

  return null;
}

export function isGraphNodePrimaryPointerButton(button: number): boolean {
  return button === 0 || button === 1;
}

export function graphPointerMovedBeyondClickThreshold(dx: number, dy: number): boolean {
  return dx * dx + dy * dy > graphNodeClickMovementThresholdSq;
}

function tokenizeGraphQuery(query: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;

  for (const match of query.matchAll(pattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    const token = value.trim();
    if (token) tokens.push(token);
  }

  return tokens;
}

export function graphLabelOpacity(scale: number, textFadeMultiplier: number): number {
  return clamp(Math.log(scale) / Math.log(2) + 1 - textFadeMultiplier, 0, 1);
}

function screenToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  view: { panX: number; panY: number; scale: number }
): { x: number; y: number } {
  return {
    x: (x - view.panX - width / 2) / view.scale,
    y: (y - view.panY - height / 2) / view.scale
  };
}

export function zoomGraphAtPoint(
  view: { panX: number; panY: number; scale: number },
  x: number,
  y: number,
  width: number,
  height: number,
  nextScale: number
): void {
  const before = screenToWorld(x, y, width, height, view);
  view.scale = clampGraphScale(nextScale);
  view.panX = x - width / 2 - before.x * view.scale;
  view.panY = y - height / 2 - before.y * view.scale;
}

export function graphWheelZoomPoint(
  currentScale: number,
  nextScale: number,
  pointerX: number,
  pointerY: number,
  width: number,
  height: number
): { x: number; y: number } {
  if (nextScale < currentScale) return { x: width / 2, y: height / 2 };

  return { x: pointerX, y: pointerY };
}

export function applyGraphKeyboardNavigation(
  view: { panX: number; panY: number; scale: number },
  keyboard: GraphKeyboardState
): void {
  const step = keyboard.shift ? 3 : 1;
  let dx = 0;
  let dy = 0;

  if (keyboard.left) dx += step;
  if (keyboard.right) dx -= step;
  if (keyboard.up) dy += step;
  if (keyboard.down) dy -= step;

  view.panX += dx * 1000 / 60;
  view.panY += dy * 1000 / 60;
}

export function applyGraphKeyboardZoom(
  view: GraphViewTransform,
  keyboard: GraphKeyboardState,
  width: number,
  height: number
): void {
  if (!keyboard.zoomIn && !keyboard.zoomOut) return;

  const step = keyboard.shift ? 1.1 : 1.03;
  let nextScale = view.targetScale;
  if (keyboard.zoomIn) nextScale *= step;
  if (keyboard.zoomOut) nextScale /= step;

  requestGraphZoom(view, width / 2, height / 2, nextScale);
}

export function requestGraphZoom(
  view: GraphViewTransform,
  x: number,
  y: number,
  nextScale: number
): void {
  view.targetScale = clampGraphScale(nextScale);
  view.zoomCenterX = x;
  view.zoomCenterY = y;
}

export function applyGraphZoomTransition(
  view: GraphViewTransform,
  width: number,
  height: number
): void {
  view.targetScale = clampGraphScale(view.targetScale);

  const currentScale = view.scale;
  const ratio = currentScale > view.targetScale ? currentScale / view.targetScale : view.targetScale / currentScale;
  if (ratio - 1 < 0.01) return;

  const zoomCenterX = view.zoomCenterX === 0 && view.zoomCenterY === 0 ? width / 2 : view.zoomCenterX;
  const zoomCenterY = view.zoomCenterX === 0 && view.zoomCenterY === 0 ? height / 2 : view.zoomCenterY;
  const nextScale = currentScale * 0.85 + view.targetScale * 0.15;

  zoomGraphAtPoint(view, zoomCenterX, zoomCenterY, width, height, nextScale);
}

export function nextGraphPanVelocity(
  current: { x: number; y: number },
  dx: number,
  dy: number
): { x: number; y: number } {
  return {
    x: current.x * 0.8 + dx * 0.2,
    y: current.y * 0.8 + dy * 0.2
  };
}

export function nextGraphPanSampleMs(current: number, elapsedMs: number): number {
  return current * 0.8 + elapsedMs * 0.2;
}

export function finishGraphPanVelocity(
  velocity: { x: number; y: number },
  sampleMs: number,
  releaseElapsedMs: number
): { x: number; y: number } {
  if (releaseElapsedMs > 100 || sampleMs <= 0) return { x: 0, y: 0 };

  return {
    x: velocity.x / sampleMs,
    y: velocity.y / sampleMs
  };
}

export function applyGraphPanInertia(
  view: { panX: number; panY: number; scale: number },
  velocity: { x: number; y: number }
): void {
  if (Math.abs(velocity.x) < 0.01) velocity.x = 0;
  if (Math.abs(velocity.y) < 0.01) velocity.y = 0;
  if (velocity.x === 0 && velocity.y === 0) return;

  view.panX += 1000 * velocity.x / 60;
  view.panY += 1000 * velocity.y / 60;
  velocity.x *= 0.9;
  velocity.y *= 0.9;
}

export function graphHoveredNodeContainsPoint(
  node: Pick<SimNode, "backlinkCount" | "linkCount" | "type" | "x" | "y">,
  point: { x: number; y: number } | null,
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  width: number,
  height: number
): boolean {
  if (!point) return false;

  const world = screenToWorld(point.x, point.y, width, height, view);
  return distance(world.x, world.y, node.x, node.y) <= graphNodeVisualRadius(node, options, view.scale) + 4 / view.scale;
}

function clampGraphScale(scale: number): number {
  return clamp(scale, graphMinScale, graphMaxScale);
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function getCanvas2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

function nextGroupColor(index: number): string {
  const colors = ["#2f66b1", "#3c8f6d", "#b06a2c", "#8d66d9", "#b74b65", "#6c7786"];

  return colors[index % colors.length];
}

function loadGraphOptions(): GraphOptions {
  const stored = loadJson<Partial<GraphOptions>>(graphOptionsStorageKey);

  return sanitizeGraphOptions(stored);
}

function sanitizeGraphOptions(value: Partial<GraphOptions> | null): GraphOptions {
  if (!value || typeof value !== "object") return defaultGraphOptions;

  return {
    centerStrength: safeNumber(value.centerStrength, defaultGraphOptions.centerStrength, 0, 1),
    hideUnresolved: typeof value.hideUnresolved === "boolean" ? value.hideUnresolved : defaultGraphOptions.hideUnresolved,
    lineSizeMultiplier: safeNumber(value.lineSizeMultiplier, defaultGraphOptions.lineSizeMultiplier, 0.1, 5),
    linkDistance: safeNumber(value.linkDistance, defaultGraphOptions.linkDistance, 30, 500),
    linkStrength: safeNumber(value.linkStrength, defaultGraphOptions.linkStrength, 0, 1),
    nodeSizeMultiplier: safeNumber(value.nodeSizeMultiplier, defaultGraphOptions.nodeSizeMultiplier, 0.1, 5),
    repelStrength: safeNumber(value.repelStrength, defaultGraphOptions.repelStrength, 0, 20),
    search: typeof value.search === "string" ? value.search.slice(0, 200) : defaultGraphOptions.search,
    showArrows: typeof value.showArrows === "boolean" ? value.showArrows : defaultGraphOptions.showArrows,
    showAttachments: typeof value.showAttachments === "boolean" ? value.showAttachments : defaultGraphOptions.showAttachments,
    showOrphans: typeof value.showOrphans === "boolean" ? value.showOrphans : defaultGraphOptions.showOrphans,
    showTags: typeof value.showTags === "boolean" ? value.showTags : defaultGraphOptions.showTags,
    textFadeMultiplier: safeNumber(value.textFadeMultiplier, defaultGraphOptions.textFadeMultiplier, -3, 3)
  };
}

function loadGraphControlsOpen(): boolean {
  const stored = loadJson<boolean>(graphControlsStorageKey);

  return typeof stored === "boolean" ? stored : true;
}

function loadGraphColorGroups(): GraphColorGroup[] {
  const stored = loadJson<unknown>(graphColorGroupsStorageKey);
  if (!Array.isArray(stored)) return [];

  return stored.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const group = item as Partial<GraphColorGroup>;
    if (typeof group.query !== "string" || typeof group.color !== "string") return [];

    return [{
      color: /^#[0-9a-f]{6}$/i.test(group.color) ? group.color : nextGroupColor(index),
      id: typeof group.id === "string" ? group.id : `group-${index}`,
      query: group.query.slice(0, 200)
    }];
  }).slice(0, 12);
}

function loadGraphSectionCollapsed(): GraphSectionCollapsedState {
  const stored = loadJson<Partial<GraphSectionCollapsedState>>(graphSectionCollapsedStorageKey);
  if (!stored || typeof stored !== "object") return defaultGraphSectionCollapsed;

  return {
    display: typeof stored.display === "boolean" ? stored.display : defaultGraphSectionCollapsed.display,
    filter: typeof stored.filter === "boolean" ? stored.filter : defaultGraphSectionCollapsed.filter,
    forces: typeof stored.forces === "boolean" ? stored.forces : defaultGraphSectionCollapsed.forces,
    groups: typeof stored.groups === "boolean" ? stored.groups : defaultGraphSectionCollapsed.groups
  };
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 設定保存に失敗してもグラフ表示自体は継続する。
  }
}

function requestGraphFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 16);
}

function cancelGraphFrame(id: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
    return;
  }

  window.clearTimeout(id);
}
