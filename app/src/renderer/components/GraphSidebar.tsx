import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement, WheelEvent } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { useT } from "../i18n";
import { useGraphStore, type GraphGroup, type GraphLinkFilter } from "../store/graphStore";

interface GraphSidebarProps {
  workspaceId: string | null;
}

interface GraphPanelProps {
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  workspaceId: string | null;
}

interface GraphPoint extends WorkspaceGraphNode {
  degree: number;
  incoming: number;
  outgoing: number;
  x: number;
  y: number;
}

interface GraphViewModel {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}

interface GraphForceSettings {
  centerForce: number;
  linkDistance: number;
  linkForce: number;
  repelForce: number;
}

const GRAPH_WIDTH = 720;
const GRAPH_HEIGHT = 520;
const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;
const GRAPH_PADDING = 28;
const GRAPH_MIN_ZOOM = 0.7;
const GRAPH_MAX_ZOOM = 1.8;

interface GraphPan {
  x: number;
  y: number;
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

function GraphControls({ workspaceId }: GraphSidebarProps): ReactElement {
  const t = useT();
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

  const folders = useMemo(() => {
    if (!graph) return [];
    return [...new Set(graph.nodes.map((node) => node.folder).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ja"));
  }, [graph]);

  const tags = useMemo(() => {
    if (!graph) return [];
    return [...new Set(graph.nodes.flatMap((node) => node.tags))]
      .sort((a, b) => a.localeCompare(b, "ja"));
  }, [graph]);

  return (
    <div className="graph-controls">
      <div className="graph-topbar">
        <div className="links-panel-subheading">{t("graph.title")}</div>
        <button className="graph-icon-button" onClick={() => loadGraph(workspaceId, true)} title={t("graph.refresh")} type="button">
          ↻
        </button>
      </div>

      <div className="graph-filters">
        <label className="graph-search">
          <span>{t("graph.search")}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("graph.searchPlaceholder")}
            type="search"
            value={query}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.folder")}</span>
          <select onChange={(event) => setFolderFilter(event.target.value)} value={folderFilter}>
            <option value="">{t("graph.allFolders")}</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>{t("graph.tag")}</span>
          <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
            <option value="">{t("graph.allTags")}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
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
          <input
            max="20"
            min="0"
            onChange={(event) => setMinDegree(Number(event.target.value))}
            type="number"
            value={minDegree}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.localDepth")}</span>
          <input
            max="3"
            min="0"
            onChange={(event) => setLocalGraphDepth(Number(event.target.value))}
            type="number"
            value={localGraphDepth}
          />
        </label>
        <div className="graph-group-controls">
          <div className="graph-group-heading">
            <span>{t("graph.groups")}</span>
            <button className="graph-mini-button" onClick={addGroup} type="button">
              {t("graph.groupAdd")}
            </button>
          </div>
          {groups.map((group) => (
            <div className="graph-group-row" key={group.id}>
              <input
                aria-label={t("graph.groupColor")}
                className="graph-group-color"
                onChange={(event) => updateGroup(group.id, { color: event.target.value })}
                type="color"
                value={group.color}
              />
              <input
                aria-label={t("graph.groupQuery")}
                onChange={(event) => updateGroup(group.id, { query: event.target.value })}
                placeholder={t("graph.searchSyntaxHint")}
                type="search"
                value={group.query}
              />
              <button
                aria-label={t("graph.groupRemove")}
                className="graph-mini-button graph-mini-button--icon"
                onClick={() => removeGroup(group.id)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <label className="setting-row">
          <span>{t("graph.zoom")}</span>
          <input
            max="1.8"
            min="0.7"
            onChange={(event) => setZoom(clamp(Number(event.target.value), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM))}
            step="0.1"
            type="range"
            value={zoom}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.nodeSize")}</span>
          <input
            max="1.8"
            min="0.6"
            onChange={(event) => setNodeSize(Number(event.target.value))}
            step="0.1"
            type="range"
            value={nodeSize}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.linkThickness")}</span>
          <input
            max="2.2"
            min="0.5"
            onChange={(event) => setLinkThickness(Number(event.target.value))}
            step="0.1"
            type="range"
            value={linkThickness}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.textFade")}</span>
          <input
            max="1.6"
            min="0.4"
            onChange={(event) => setTextFadeThreshold(Number(event.target.value))}
            step="0.1"
            type="range"
            value={textFadeThreshold}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.centerForce")}</span>
          <input
            max="2"
            min="0.2"
            onChange={(event) => setCenterForce(Number(event.target.value))}
            step="0.1"
            type="range"
            value={centerForce}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.repelForce")}</span>
          <input
            max="2.2"
            min="0.4"
            onChange={(event) => setRepelForce(Number(event.target.value))}
            step="0.1"
            type="range"
            value={repelForce}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.linkForce")}</span>
          <input
            max="2"
            min="0.3"
            onChange={(event) => setLinkForce(Number(event.target.value))}
            step="0.1"
            type="range"
            value={linkForce}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.linkDistance")}</span>
          <input
            max="190"
            min="60"
            onChange={(event) => setLinkDistance(Number(event.target.value))}
            step="5"
            type="range"
            value={linkDistance}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.labels")}</span>
          <input
            checked={showLabels}
            onChange={(event) => setShowLabels(event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.arrows")}</span>
          <input
            checked={showArrows}
            onChange={(event) => setShowArrows(event.target.checked)}
            type="checkbox"
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.showOrphans")}</span>
          <input
            checked={showOrphans}
            onChange={(event) => setShowOrphans(event.target.checked)}
            type="checkbox"
          />
        </label>
        <button className="graph-reset-button" onClick={resetFilters} type="button">
          {t("graph.reset")}
        </button>
      </div>
    </div>
  );
}

export function GraphPanel({ activeFilePath, onOpenFile, workspaceId }: GraphPanelProps): ReactElement {
  const t = useT();
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
  const [nodePositions, setNodePositions] = useState<Record<string, GraphPan>>({});
  const [pan, setPan] = useState<GraphPan>({ x: 0, y: 0 });

  useEffect(() => {
    loadGraph(workspaceId);
  }, [loadGraph, workspaceId]);

  const graphStats = useMemo(() => graph ? buildGraphStats(graph.edges) : new Map<string, NodeStats>(), [graph]);
  const filteredGraph = useMemo<GraphViewModel>(() => {
    if (!graph) return { edges: [], nodes: [] };

    const normalizedQuery = query.trim().toLocaleLowerCase();
    const nodes = graph.nodes.filter((node) => {
      const stats = graphStats.get(node.path) ?? emptyNodeStats();
      const degree = stats.incoming + stats.outgoing;

      if (folderFilter && node.folder !== folderFilter) return false;
      if (tagFilter && !node.tags.includes(tagFilter)) return false;
      if (linkFilter === "linked" && degree === 0) return false;
      if (linkFilter === "unlinked" && degree > 0) return false;
      if (!showOrphans && degree === 0) return false;
      if (degree < minDegree) return false;
      if (
        normalizedQuery &&
        !node.name.toLocaleLowerCase().includes(normalizedQuery) &&
        !node.path.toLocaleLowerCase().includes(normalizedQuery)
      ) return false;
      return true;
    });
    const nodePaths = new Set(nodes.map((node) => node.path));
    const visibleLocalPaths = localGraphDepth > 0 && activeFilePath
      ? collectLocalGraphPaths(graph.edges, activeFilePath, localGraphDepth)
      : null;
    const localNodePaths = visibleLocalPaths
      ? new Set([...nodePaths].filter((path) => visibleLocalPaths.has(path)))
      : nodePaths;
    const edges = graph.edges.filter((edge) => localNodePaths.has(edge.sourcePath) && localNodePaths.has(edge.targetPath));

    return { edges, nodes: nodes.filter((node) => localNodePaths.has(node.path)) };
  }, [activeFilePath, folderFilter, graph, graphStats, linkFilter, localGraphDepth, minDegree, query, showOrphans, tagFilter]);

  const points = useMemo(
    () => layoutGraph(filteredGraph.nodes, filteredGraph.edges, selectedPath, {
      centerForce,
      linkDistance,
      linkForce,
      repelForce
    }).map((point) => {
      const manualPosition = nodePositions[point.path];
      return manualPosition ? { ...point, x: manualPosition.x, y: manualPosition.y } : point;
    }),
    [centerForce, filteredGraph.edges, filteredGraph.nodes, linkDistance, linkForce, nodePositions, repelForce, selectedPath]
  );
  const pointByPath = useMemo(() => new Map(points.map((point) => [point.path, point])), [points]);
  const focusedPath = hoveredPath ?? selectedPath;
  const relatedPaths = useMemo(() => {
    if (!focusedPath) return new Set<string>();
    const paths = new Set([focusedPath]);
    for (const edge of filteredGraph.edges) {
      if (edge.sourcePath === focusedPath) paths.add(edge.targetPath);
      if (edge.targetPath === focusedPath) paths.add(edge.sourcePath);
    }
    return paths;
  }, [filteredGraph.edges, focusedPath]);
  const labelOpacity = showLabels
    ? clamp((zoom - textFadeThreshold + 0.5) / 0.5, 0.18, 1)
    : 0;
  const groupByPath = useMemo(() => {
    const activeGroups = groups.filter((group) => group.query.trim());
    if (activeGroups.length === 0) return new Map<string, GraphGroup>();

    const result = new Map<string, GraphGroup>();
    for (const node of filteredGraph.nodes) {
      const group = activeGroups.find((candidate) => matchesGraphGroup(node, candidate.query));
      if (group) result.set(node.path, group);
    }
    return result;
  }, [filteredGraph.nodes, groups]);

  function getGraphDelta(deltaX: number, deltaY: number): GraphPan {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return { x: deltaX, y: deltaY };
    return {
      x: deltaX * (GRAPH_WIDTH / bounds.width),
      y: deltaY * (GRAPH_HEIGHT / bounds.height)
    };
  }

  function handleGraphWheel(event: WheelEvent<SVGSVGElement>): void {
    event.preventDefault();
    const nextZoom = clamp(zoom - event.deltaY * 0.001, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    setZoom(Number(nextZoom.toFixed(2)));
  }

  function handleGraphKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
    const panStep = event.shiftKey ? 72 : 28;
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
      setPan((current) => ({ ...current, y: current.y + panStep }));
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setPan((current) => ({ ...current, y: current.y - panStep }));
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPan((current) => ({ ...current, x: current.x + panStep }));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPan((current) => ({ ...current, x: current.x - panStep }));
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
      x: dragState.startPan.x + delta.x,
      y: dragState.startPan.y + delta.y
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
    setNodePositions((current) => ({
      ...current,
      [dragState.path]: {
        x: clamp(dragState.startPoint.x + graphDelta.x / zoom, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING),
        y: clamp(dragState.startPoint.y + graphDelta.y / zoom, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING)
      }
    }));
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
      <div className="graph-hover-settings">
        <GraphControls workspaceId={workspaceId} />
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
            viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
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
            <g transform={`translate(${GRAPH_CENTER_X * (1 - zoom) + pan.x} ${GRAPH_CENTER_Y * (1 - zoom) + pan.y}) scale(${zoom})`}>
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
                  const radius = Math.min(13, 3.8 + Math.sqrt(point.incoming) * 2.2) * nodeSize;
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

interface NodeStats {
  incoming: number;
  outgoing: number;
}

function emptyNodeStats(): NodeStats {
  return { incoming: 0, outgoing: 0 };
}

function buildGraphStats(edges: WorkspaceGraphEdge[]): Map<string, NodeStats> {
  const stats = new Map<string, NodeStats>();

  for (const edge of edges) {
    const source = stats.get(edge.sourcePath) ?? emptyNodeStats();
    const target = stats.get(edge.targetPath) ?? emptyNodeStats();
    source.outgoing += 1;
    target.incoming += 1;
    stats.set(edge.sourcePath, source);
    stats.set(edge.targetPath, target);
  }

  return stats;
}

function matchesGraphGroup(node: WorkspaceGraphNode, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return false;

  if (normalizedQuery.startsWith("#")) {
    const tagQuery = normalizedQuery.slice(1);
    return node.tags.some((tag) => tag.toLocaleLowerCase().includes(tagQuery));
  }

  if (normalizedQuery.startsWith("folder:")) {
    const folderQuery = normalizedQuery.slice("folder:".length).trim();
    return node.folder.toLocaleLowerCase().includes(folderQuery);
  }

  return (
    node.name.toLocaleLowerCase().includes(normalizedQuery) ||
    node.path.toLocaleLowerCase().includes(normalizedQuery) ||
    node.folder.toLocaleLowerCase().includes(normalizedQuery) ||
    node.tags.some((tag) => tag.toLocaleLowerCase().includes(normalizedQuery))
  );
}

function collectLocalGraphPaths(edges: WorkspaceGraphEdge[], centerPath: string, depth: number): Set<string> {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const sourceNeighbors = adjacency.get(edge.sourcePath) ?? new Set<string>();
    const targetNeighbors = adjacency.get(edge.targetPath) ?? new Set<string>();
    sourceNeighbors.add(edge.targetPath);
    targetNeighbors.add(edge.sourcePath);
    adjacency.set(edge.sourcePath, sourceNeighbors);
    adjacency.set(edge.targetPath, targetNeighbors);
  }

  const visible = new Set([centerPath]);
  let frontier = new Set([centerPath]);

  for (let currentDepth = 0; currentDepth < depth; currentDepth += 1) {
    const nextFrontier = new Set<string>();
    for (const path of frontier) {
      for (const neighbor of adjacency.get(path) ?? []) {
        if (!visible.has(neighbor)) {
          visible.add(neighbor);
          nextFrontier.add(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return visible;
}

function layoutGraph(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  selectedPath: string | null,
  forceSettings: GraphForceSettings
): GraphPoint[] {
  const stats = buildGraphStats(edges);
  const initial = nodes.map((node, index) => {
    const nodeStats = stats.get(node.path) ?? emptyNodeStats();
    const degree = nodeStats.incoming + nodeStats.outgoing;
    const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;
    const radius = Math.min(190, 96 + (index % 7) * 17);

    return {
      ...node,
      degree,
      incoming: nodeStats.incoming,
      outgoing: nodeStats.outgoing,
      x: GRAPH_CENTER_X + Math.cos(angle) * radius,
      y: GRAPH_CENTER_Y + Math.sin(angle) * radius
    };
  });

  if (initial.length <= 1) {
    return initial.map((node) => ({ ...node, x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y }));
  }

  const linkedPairs = edges
    .map((edge) => ({
      sourceIndex: initial.findIndex((node) => node.path === edge.sourcePath),
      targetIndex: initial.findIndex((node) => node.path === edge.targetPath)
    }))
    .filter((edge) => edge.sourceIndex >= 0 && edge.targetIndex >= 0);

  for (let tick = 0; tick < 96; tick += 1) {
    const forces = initial.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < initial.length; i += 1) {
      for (let j = i + 1; j < initial.length; j += 1) {
        const dx = initial[j].x - initial[i].x || 0.01;
        const dy = initial[j].y - initial[i].y || 0.01;
        const distanceSquared = Math.max(64, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSquared);
        const strength = (1550 * forceSettings.repelForce) / distanceSquared;
        const fx = (dx / distance) * strength;
        const fy = (dy / distance) * strength;
        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }
    }

    for (const edge of linkedPairs) {
      const source = initial[edge.sourceIndex];
      const target = initial[edge.targetIndex];
      const dx = target.x - source.x || 0.01;
      const dy = target.y - source.y || 0.01;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const preferred = forceSettings.linkDistance;
      const strength = (distance - preferred) * 0.014 * forceSettings.linkForce;
      const fx = (dx / distance) * strength;
      const fy = (dy / distance) * strength;
      forces[edge.sourceIndex].x += fx;
      forces[edge.sourceIndex].y += fy;
      forces[edge.targetIndex].x -= fx;
      forces[edge.targetIndex].y -= fy;
    }

    for (let i = 0; i < initial.length; i += 1) {
      const node = initial[i];
      const isPinned = node.path === selectedPath;
      const centerStrength = (isPinned ? 0.08 : 0.018) * forceSettings.centerForce;
      forces[i].x += (GRAPH_CENTER_X - node.x) * centerStrength;
      forces[i].y += (GRAPH_CENTER_Y - node.y) * centerStrength;
      node.x = clamp(node.x + forces[i].x, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
      node.y = clamp(node.y + forces[i].y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
    }
  }

  return initial.sort((a, b) => {
    if (a.path === selectedPath) return 1;
    if (b.path === selectedPath) return -1;
    return a.path.localeCompare(b.path, "ja");
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
