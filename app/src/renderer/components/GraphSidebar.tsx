import type { ReactElement } from "react";

import { buildGraphViewBox } from "../graphLayout";
import { useGraphPanelModel } from "../hooks/useGraphPanelModel";
import { useT } from "../i18n";
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
  const {
    error,
    filteredGraph,
    focusedPath,
    graphCanvas,
    groupByPath,
    isMotionAfterglow,
    isLoading,
    labelOpacity,
    linkThickness,
    motionEpoch,
    motionPath,
    nodeSize,
    selectedPath,
    showArrows,
    showLabels
  } = useGraphPanelModel({
    activeFilePath,
    onOpenFile,
    workspaceId
  });

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
        ) : graphCanvas.points.length === 0 ? (
          <div className="frontmatter-field-empty">{t("graph.empty")}</div>
        ) : (
          <GraphCanvas
            edges={filteredGraph.edges}
            focusedPath={focusedPath}
            groupByPath={groupByPath}
            isMotionAfterglow={isMotionAfterglow}
            isPanning={graphCanvas.isPanning}
            labelOpacity={labelOpacity}
            linkThickness={linkThickness}
            motionEpoch={motionEpoch}
            motionPath={motionPath}
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
            pointsRef={graphCanvas.pointsRef}
            relatedPaths={graphCanvas.relatedPaths}
            selectedPath={selectedPath}
            showArrows={showArrows}
            showLabels={showLabels}
            surfaceRef={graphCanvas.surfaceRef}
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
