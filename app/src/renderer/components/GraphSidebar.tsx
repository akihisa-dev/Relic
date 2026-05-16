import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement, WheelEvent } from "react";

import {
  buildFilteredGraph,
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
import { useGraphStore } from "../store/graphStore";
import { GraphControls, useGraphFloatingPanelPosition } from "./GraphControls";

export { buildGraphViewBox } from "../graphLayout";

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

export function GraphPanel({ activeFilePath, onOpenFile, workspaceId }: GraphPanelProps): ReactElement {
  const t = useT();
  const floatingPanel = useGraphFloatingPanelPosition();
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
