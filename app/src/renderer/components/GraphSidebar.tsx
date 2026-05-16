import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import {
  buildFilteredGraph,
  buildGraphViewBox,
  clamp,
  buildGroupByPath
} from "../graphLayout";
import type { GraphForceSettings, GraphViewModel } from "../graphLayout";
import { useGraphCanvasInteractions } from "../hooks/useGraphCanvasInteractions";
import { useGraphFloatingPanelPosition } from "../hooks/useGraphFloatingPanelPosition";
import { useT } from "../i18n";
import { useGraphStore } from "../store/graphStore";
import { GraphCanvas } from "./GraphCanvas";
import { GraphControls } from "./GraphControls";

export { buildGraphViewBox } from "../graphLayout";

interface GraphPanelProps {
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  workspaceId: string | null;
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
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

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
  const focusedPath = hoveredPath ?? selectedPath;
  const labelOpacity = showLabels
    ? clamp((zoom - textFadeThreshold + 0.5) / 0.5, 0.18, 1)
    : 0;
  const groupByPath = useMemo(() => buildGroupByPath(filteredGraph.nodes, groups), [filteredGraph.nodes, groups]);
  const forceSettings = useMemo<GraphForceSettings>(() => ({
    centerForce,
    linkDistance,
    linkForce,
    repelForce
  }), [centerForce, linkDistance, linkForce, repelForce]);
  const graphCanvas = useGraphCanvasInteractions({
    edges: filteredGraph.edges,
    focusedPath,
    forceSettings,
    nodes: filteredGraph.nodes,
    onOpenFile,
    selectedPath,
    setFocusedPath: setHoveredPath,
    setSelectedPath,
    setZoom,
    zoom
  });

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
        ) : graphCanvas.points.length === 0 ? (
          <div className="frontmatter-field-empty">{t("graph.empty")}</div>
        ) : (
          <GraphCanvas
            edges={filteredGraph.edges}
            focusedPath={focusedPath}
            groupByPath={groupByPath}
            isPanning={graphCanvas.isPanning}
            labelOpacity={labelOpacity}
            linkThickness={linkThickness}
            nodeSize={nodeSize}
            onGraphKeyDown={graphCanvas.graphHandlers.onKeyDown}
            onGraphPointerCancel={graphCanvas.graphHandlers.onPointerCancel}
            onGraphPointerDown={graphCanvas.graphHandlers.onPointerDown}
            onGraphPointerMove={graphCanvas.graphHandlers.onPointerMove}
            onGraphPointerUp={graphCanvas.graphHandlers.onPointerUp}
            onGraphWheel={graphCanvas.graphHandlers.onWheel}
            onNodeClick={graphCanvas.nodeHandlers.onClick}
            onNodeKeyDown={graphCanvas.nodeHandlers.onKeyDown}
            onNodePointerCancel={graphCanvas.nodeHandlers.onPointerCancel}
            onNodePointerDown={graphCanvas.nodeHandlers.onPointerDown}
            onNodePointerEnter={graphCanvas.nodeHandlers.onPointerEnter}
            onNodePointerLeave={graphCanvas.nodeHandlers.onPointerLeave}
            onNodePointerMove={graphCanvas.nodeHandlers.onPointerMove}
            onNodePointerUp={graphCanvas.nodeHandlers.onPointerUp}
            points={graphCanvas.points}
            relatedPaths={graphCanvas.relatedPaths}
            selectedPath={selectedPath}
            showArrows={showArrows}
            showLabels={showLabels}
            svgRef={graphCanvas.svgRef}
            viewBox={graphCanvas.viewBox}
          />
        )}
      </div>

      <div className="graph-summary">
        {t("graph.summary", { edges: filteredGraph.edges.length, nodes: filteredGraph.nodes.length })}
      </div>
    </div>
  );
}
