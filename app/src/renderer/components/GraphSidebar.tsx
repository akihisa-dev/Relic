import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement, ReactNode, RefObject, WheelEvent } from "react";

import {
  buildFilteredGraph,
  buildGraphFolders,
  buildGraphTags,
  buildGraphViewBox,
  buildGroupByPath,
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
import type { GraphPan, GraphPoint, GraphSimPoint, GraphViewModel } from "../graphLayout";
import { useT } from "../i18n";
import { useGraphStore, type GraphLinkFilter } from "../store/graphStore";

export { buildGraphViewBox } from "../graphLayout";

interface GraphSidebarProps {
  onDragHandlePointerDown?: (event: PointerEvent<HTMLElement>) => void;
  workspaceId: string | null;
}

interface GraphPanelProps {
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  workspaceId: string | null;
}

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

function useFloatingPanelPosition(): {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties | undefined;
} {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return;

    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;

    event.preventDefault();
    event.stopPropagation();

    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetX = event.clientX - panelRect.left;
    const offsetY = event.clientY - panelRect.top;

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const margin = 8;
      const maxX = Math.max(margin, containerRect.width - panelRect.width - margin);
      const maxY = Math.max(margin, containerRect.height - panelRect.height - margin);

      setPosition({
        x: clamp(moveEvent.clientX - containerRect.left - offsetX, margin, maxX),
        y: clamp(moveEvent.clientY - containerRect.top - offsetY, margin, maxY)
      });
    };

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    setPosition({
      x: clamp(panelRect.left - containerRect.left, 8, Math.max(8, containerRect.width - panelRect.width - 8)),
      y: clamp(panelRect.top - containerRect.top, 8, Math.max(8, containerRect.height - panelRect.height - 8))
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return {
    onPointerDown,
    panelRef,
    style: position
      ? { left: position.x, right: "auto", top: position.y, transform: "none" }
      : undefined
  };
}

function GraphControls({ onDragHandlePointerDown, workspaceId }: GraphSidebarProps): ReactElement {
  const t = useT();
  const [isMinimized, setIsMinimized] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const {
    addGroup,
    centerForce,
    folderFilter,
    graph,
    groups,
    linkDistance,
    linkFilter,
    linkForce,
    linkThickness,
    localGraphDepth,
    loadGraph,
    minDegree,
    nodeSize,
    query,
    removeGroup,
    resetFilters,
    setCenterForce,
    setFolderFilter,
    setLinkDistance,
    setLinkFilter,
    setLinkForce,
    setLinkThickness,
    setLocalGraphDepth,
    setMinDegree,
    setNodeSize,
    setQuery,
    setRepelForce,
    setShowArrows,
    setShowLabels,
    setShowOrphans,
    setTagFilter,
    setTextFadeThreshold,
    setZoom,
    showArrows,
    showLabels,
    showOrphans,
    tagFilter,
    textFadeThreshold,
    repelForce,
    updateGroup,
    zoom
  } = useGraphStore();

  useEffect(() => {
    loadGraph(workspaceId);
  }, [loadGraph, workspaceId]);

  const folders = useMemo(() => buildGraphFolders(graph), [graph]);
  const tags = useMemo(() => buildGraphTags(graph), [graph]);

  function toggleSection(section: string): void {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  if (isMinimized) {
    return (
      <button className="graph-controls-minimized" onClick={() => setIsMinimized(false)} title={t("graph.expand")} type="button">
        ⋯
      </button>
    );
  }

  return (
    <div className="graph-controls">
      <div className="graph-topbar">
        <div className="graph-topbar-title">
          {onDragHandlePointerDown ? (
            <button
              aria-label={t("graph.dragHandle")}
              className="hover-menu-drag-handle"
              onPointerDown={onDragHandlePointerDown}
              title={t("graph.dragHandle")}
              type="button"
            >
              <span />
            </button>
          ) : null}
          <div className="links-panel-subheading">{t("graph.title")}</div>
        </div>
        <div className="graph-topbar-actions">
        <button className="graph-icon-button" onClick={() => loadGraph(workspaceId, true)} title={t("graph.refresh")} type="button">
          ↻
        </button>
          <button className="graph-icon-button" onClick={() => setIsMinimized(true)} title={t("graph.collapse")} type="button">
            ×
          </button>
        </div>
      </div>

      <div className="graph-filters">
        <GraphControlSection isOpen={!!openSections.filter} label={t("graph.filter")} onToggle={() => toggleSection("filter")}>
          <label className="graph-search">
            <span>{t("graph.search")}</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder={t("graph.searchPlaceholder")} type="search" value={query} />
          </label>
          <label className="setting-row">
            <span>{t("graph.folder")}</span>
            <select onChange={(event) => setFolderFilter(event.target.value)} value={folderFilter}>
              <option value="">{t("graph.allFolders")}</option>
              {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
            </select>
          </label>
          <label className="setting-row">
            <span>{t("graph.tag")}</span>
            <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
              <option value="">{t("graph.allTags")}</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="setting-row">
            <span>{t("graph.links")}</span>
            <select onChange={(event) => setLinkFilter(event.target.value as GraphLinkFilter)} value={linkFilter}>
              <option value="all">{t("graph.linksAll")}</option>
              <option value="linked">{t("graph.linksLinked")}</option>
              <option value="unlinked">{t("graph.linksUnlinked")}</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{t("graph.minLinks")}</span>
            <input max="20" min="0" onChange={(event) => setMinDegree(Number(event.target.value))} type="number" value={minDegree} />
          </label>
          <label className="setting-row">
            <span>{t("graph.localDepth")}</span>
            <input max="3" min="0" onChange={(event) => setLocalGraphDepth(Number(event.target.value))} type="number" value={localGraphDepth} />
          </label>
        </GraphControlSection>

        <GraphControlSection isOpen={!!openSections.groups} label={t("graph.groups")} onToggle={() => toggleSection("groups")}>
          <div className="graph-group-heading">
            <span>{t("graph.groups")}</span>
            <button className="graph-mini-button" onClick={addGroup} type="button">{t("graph.groupAdd")}</button>
          </div>
          {groups.map((group) => (
            <div className="graph-group-row" key={group.id}>
              <input aria-label={t("graph.groupColor")} className="graph-group-color" onChange={(event) => updateGroup(group.id, { color: event.target.value })} type="color" value={group.color} />
              <input aria-label={t("graph.groupQuery")} onChange={(event) => updateGroup(group.id, { query: event.target.value })} placeholder={t("graph.searchSyntaxHint")} type="search" value={group.query} />
              <button aria-label={t("graph.groupRemove")} className="graph-mini-button graph-mini-button--icon" onClick={() => removeGroup(group.id)} type="button">×</button>
            </div>
          ))}
        </GraphControlSection>

        <GraphControlSection isOpen={!!openSections.display} label={t("graph.viewSettings")} onToggle={() => toggleSection("display")}>
          <label className="setting-row"><span>{t("graph.zoom")}</span><input max="1.8" min="0.7" onChange={(event) => setZoom(clamp(Number(event.target.value), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM))} step="0.1" type="range" value={zoom} /></label>
          <label className="setting-row"><span>{t("graph.nodeSize")}</span><input max="1.8" min="0.6" onChange={(event) => setNodeSize(Number(event.target.value))} step="0.1" type="range" value={nodeSize} /></label>
          <label className="setting-row"><span>{t("graph.linkThickness")}</span><input max="2.2" min="0.5" onChange={(event) => setLinkThickness(Number(event.target.value))} step="0.1" type="range" value={linkThickness} /></label>
          <label className="setting-row"><span>{t("graph.textFade")}</span><input max="1.6" min="0.4" onChange={(event) => setTextFadeThreshold(Number(event.target.value))} step="0.1" type="range" value={textFadeThreshold} /></label>
          <label className="setting-row"><span>{t("graph.labels")}</span><input checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} type="checkbox" /></label>
          <label className="setting-row"><span>{t("graph.arrows")}</span><input checked={showArrows} onChange={(event) => setShowArrows(event.target.checked)} type="checkbox" /></label>
          <label className="setting-row"><span>{t("graph.showOrphans")}</span><input checked={showOrphans} onChange={(event) => setShowOrphans(event.target.checked)} type="checkbox" /></label>
        </GraphControlSection>

        <GraphControlSection isOpen={!!openSections.forces} label={t("graph.forces")} onToggle={() => toggleSection("forces")}>
          <label className="setting-row"><span>{t("graph.centerForce")}</span><input max="2" min="0.2" onChange={(event) => setCenterForce(Number(event.target.value))} step="0.1" type="range" value={centerForce} /></label>
          <label className="setting-row"><span>{t("graph.repelForce")}</span><input max="2.2" min="0.4" onChange={(event) => setRepelForce(Number(event.target.value))} step="0.1" type="range" value={repelForce} /></label>
          <label className="setting-row"><span>{t("graph.linkForce")}</span><input max="2" min="0.3" onChange={(event) => setLinkForce(Number(event.target.value))} step="0.1" type="range" value={linkForce} /></label>
          <label className="setting-row"><span>{t("graph.linkDistance")}</span><input max="190" min="60" onChange={(event) => setLinkDistance(Number(event.target.value))} step="5" type="range" value={linkDistance} /></label>
        </GraphControlSection>
        <button className="graph-reset-button" onClick={resetFilters} type="button">
          {t("graph.reset")}
        </button>
      </div>
    </div>
  );
}

function GraphControlSection({
  children,
  isOpen,
  label,
  onToggle
}: {
  children: ReactNode;
  isOpen: boolean;
  label: string;
  onToggle: () => void;
}): ReactElement {
  return (
    <div className="graph-control-section">
      <button className="graph-control-section-title" onClick={onToggle} type="button">
        <span>{isOpen ? "⌄" : "›"}</span>
        <span>{label}</span>
      </button>
      {isOpen ? <div className="graph-control-section-body">{children}</div> : null}
    </div>
  );
}

export function GraphPanel({ activeFilePath, onOpenFile, workspaceId }: GraphPanelProps): ReactElement {
  const t = useT();
  const floatingPanel = useFloatingPanelPosition();
  const {
    centerForce,
    error,
    folderFilter,
    graph,
    groups,
    isLoading,
    linkDistance,
    linkFilter,
    linkForce,
    linkThickness,
    localGraphDepth,
    loadGraph,
    minDegree,
    nodeSize,
    query,
    repelForce,
    selectedPath,
    setSelectedPath,
    setZoom,
    showArrows,
    showLabels,
    showOrphans,
    tagFilter,
    textFadeThreshold,
    zoom
  } = useGraphStore();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStateRef = useRef<GraphDragState | null>(null);
  const suppressNodeClickRef = useRef(false);
  const nodeDragStateRef = useRef<GraphNodeDragState | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const simPointsRef = useRef<GraphSimPoint[]>([]);
  const [simPoints, setSimPoints] = useState<GraphSimPoint[]>([]);
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 });

  useEffect(() => {
    loadGraph(workspaceId);
  }, [loadGraph, workspaceId]);

  const filteredGraph = useMemo<GraphViewModel>(() => buildFilteredGraph({
    activeFilePath,
    folderFilter,
    graph,
    linkFilter,
    localGraphDepth,
    minDegree,
    query,
    showOrphans,
    tagFilter
  }), [activeFilePath, folderFilter, graph, linkFilter, localGraphDepth, minDegree, query, showOrphans, tagFilter]);

  useEffect(() => {
    const seedPoints = layoutGraph(filteredGraph.nodes, filteredGraph.edges, {
      centerForce,
      linkDistance,
      linkForce,
      repelForce
    });
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
  }, [filteredGraph.edges, filteredGraph.nodes]);

  useEffect(() => {
    if (filteredGraph.nodes.length === 0) return;

    let frameId = 0;

    function tick(): void {
      if (dragStateRef.current) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const nextPoints = tickGraphSimulation(
        simPointsRef.current,
        filteredGraph.edges,
        { centerForce, linkDistance, linkForce, repelForce },
        nodeDragStateRef.current?.path ?? null
      );
      simPointsRef.current = nextPoints;
      setSimPoints(nextPoints);

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [centerForce, filteredGraph.edges, filteredGraph.nodes.length, linkDistance, linkForce, repelForce]);

  const points = simPoints;
  const pointByPath = useMemo(() => new Map(points.map((point) => [point.path, point])), [points]);
  const focusedPath = hoveredPath ?? selectedPath;
  const relatedPaths = useMemo(() => collectRelatedGraphPaths(filteredGraph.edges, focusedPath), [filteredGraph.edges, focusedPath]);
  const labelOpacity = showLabels
    ? clamp((zoom - textFadeThreshold + 0.5) / 0.5, 0.18, 1)
    : 0;
  const groupByPath = useMemo(() => buildGroupByPath(filteredGraph.nodes, groups), [filteredGraph.nodes, groups]);
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

  return (
    <div className="graph-panel">
      <div className="graph-hover-settings" ref={floatingPanel.panelRef} style={floatingPanel.style}>
        <GraphControls onDragHandlePointerDown={floatingPanel.onPointerDown} workspaceId={workspaceId} />
      </div>
      <div className="graph-canvas" aria-label={t("graph.title")}>
        {isLoading ? (
          <div className="frontmatter-field-empty">{t("common.loading")}</div>
        ) : error ? (
          <div className="frontmatter-field-empty">{error}</div>
        ) : points.length === 0 ? (
          <div className="frontmatter-field-empty">{t("graph.empty")}</div>
        ) : (
          <svg
            className={isPanning ? "graph-svg graph-svg--panning" : "graph-svg"}
            onKeyDown={handleGraphKeyDown}
            onPointerCancel={handleGraphPointerEnd}
            onPointerDown={handleGraphPointerDown}
            onPointerMove={handleGraphPointerMove}
            onPointerUp={handleGraphPointerEnd}
            onWheel={handleGraphWheel}
            ref={svgRef}
            role="img"
            tabIndex={0}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          >
            {showArrows ? (
              <defs>
                <marker id="graph-arrow" markerHeight="8" markerUnits="userSpaceOnUse" markerWidth="8" orient="auto" refX="8" refY="4">
                  <path className="graph-arrow-marker" d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
                <marker id="graph-arrow-selected" markerHeight="8" markerUnits="userSpaceOnUse" markerWidth="8" orient="auto" refX="8" refY="4">
                  <path className="graph-arrow-marker graph-arrow-marker--selected" d="M 0 0 L 8 4 L 0 8 z" />
                </marker>
              </defs>
            ) : null}
            <g>
              <g className="graph-edge-layer">
                {filteredGraph.edges.map((edge) => {
                  const source = pointByPath.get(edge.sourcePath);
                  const target = pointByPath.get(edge.targetPath);
                  if (!source || !target) return null;
                  const isFocused = focusedPath === edge.sourcePath || focusedPath === edge.targetPath;
                  const className = [
                    "graph-edge",
                    isFocused ? "graph-edge--selected" : "",
                    focusedPath && !isFocused ? "graph-edge--dimmed" : ""
                  ].filter(Boolean).join(" ");
                  return (
                    <line
                      className={className}
                      key={`${edge.sourcePath}-${edge.targetPath}`}
                      markerEnd={showArrows ? `url(#${isFocused ? "graph-arrow-selected" : "graph-arrow"})` : undefined}
                      style={{ strokeWidth: (isFocused ? 1.6 : 0.9) * linkThickness }}
                      x1={source.x}
                      x2={target.x}
                      y1={source.y}
                      y2={target.y}
                    />
                  );
                })}
              </g>
              <g className="graph-node-layer">
                {points.map((point) => {
                  const isSelected = point.path === selectedPath;
                  const isRelated = relatedPaths.has(point.path);
                  const isFocused = point.path === focusedPath;
                  const group = groupByPath.get(point.path);
                  const radius = Math.min(8, 2.6 + Math.sqrt(point.incoming) * 1.45) * nodeSize;
                  const nodeClassName = [
                    "graph-node",
                    isSelected ? "graph-node--selected" : "",
                    isFocused && !isSelected ? "graph-node--focused" : "",
                    focusedPath && !isRelated ? "graph-node--dimmed" : "",
                    focusedPath && isRelated && !isSelected && !isFocused ? "graph-node--related" : ""
                  ].filter(Boolean).join(" ");
                  const labelClassName = focusedPath && !isRelated ? "graph-label graph-label--dimmed" : "graph-label";

                  return (
                    <g
                      aria-label={point.name}
                      className="graph-node-hit"
                      key={point.path}
                      onClick={() => {
                        if (suppressNodeClickRef.current) {
                          suppressNodeClickRef.current = false;
                          return;
                        }
                        setSelectedPath(point.path);
                        onOpenFile(point.path);
                      }}
                      onPointerEnter={() => setHoveredPath(point.path)}
                      onPointerCancel={handleNodePointerCancel}
                      onPointerDown={(event) => handleNodePointerDown(event, point)}
                      onPointerMove={handleNodePointerMove}
                      onPointerUp={(event) => handleNodePointerEnd(event, point)}
                      onPointerLeave={() => setHoveredPath((current) => current === point.path ? null : current)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          setSelectedPath(point.path);
                          onOpenFile(point.path);
                        }
                        if (event.key === " ") {
                          event.preventDefault();
                          setSelectedPath(point.path);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <circle
                        className={nodeClassName}
                        cx={point.x}
                        cy={point.y}
                        r={radius}
                        style={group ? { fill: group.color } : undefined}
                      />
                      {showLabels ? (
                        <text className={labelClassName} style={{ opacity: labelOpacity }} x={point.x + radius + 5} y={point.y + 4}>{point.name}</text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}
      </div>

      <div className="graph-summary">
        {t("graph.summary", { edges: filteredGraph.edges.length, nodes: filteredGraph.nodes.length })}
      </div>
    </div>
  );
}
