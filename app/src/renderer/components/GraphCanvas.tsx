import { useMemo } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement, RefObject, WheelEvent } from "react";

import type { WorkspaceGraphEdge } from "../../shared/ipc";
import type { GraphPoint, GraphViewBox } from "../graphLayout";
import type { GraphGroup } from "../store/graphStore";
import { GraphArrowMarkers, GraphEdgeLayer, GraphNodeLayer } from "./GraphCanvasLayers";

export interface GraphCanvasProps {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  groupByPath: Map<string, GraphGroup>;
  isMotionAfterglow: boolean;
  isPanning: boolean;
  labelOpacity: number;
  linkThickness: number;
  motionEpoch: number;
  motionPath: string | null;
  nodeSize: number;
  onGraphKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
  onGraphPointerCancel: (event: PointerEvent<SVGSVGElement>) => void;
  onGraphPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onGraphPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onGraphPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
  onGraphWheel: (event: WheelEvent<SVGSVGElement>) => void;
  onNodeClick: (point: GraphPoint) => void;
  onNodeKeyDown: (event: KeyboardEvent<SVGGElement>, point: GraphPoint) => void;
  onNodePointerCancel: (event: PointerEvent<SVGGElement>) => void;
  onNodePointerDown: (event: PointerEvent<SVGGElement>, point: GraphPoint) => void;
  onNodePointerEnter: (path: string) => void;
  onNodePointerLeave: (path: string) => void;
  onNodePointerMove: (event: PointerEvent<SVGGElement>) => void;
  onNodePointerUp: (event: PointerEvent<SVGGElement>, point: GraphPoint) => void;
  points: GraphPoint[];
  relatedPaths: Set<string>;
  selectedPath: string | null;
  showArrows: boolean;
  showLabels: boolean;
  svgRef: RefObject<SVGSVGElement | null>;
  viewBox: GraphViewBox;
}

export function GraphCanvas({
  edges,
  focusedPath,
  groupByPath,
  isMotionAfterglow,
  isPanning,
  labelOpacity,
  linkThickness,
  motionEpoch,
  motionPath,
  nodeSize,
  onGraphKeyDown,
  onGraphPointerCancel,
  onGraphPointerDown,
  onGraphPointerMove,
  onGraphPointerUp,
  onGraphWheel,
  onNodeClick,
  onNodeKeyDown,
  onNodePointerCancel,
  onNodePointerDown,
  onNodePointerEnter,
  onNodePointerLeave,
  onNodePointerMove,
  onNodePointerUp,
  points,
  relatedPaths,
  selectedPath,
  showArrows,
  showLabels,
  svgRef,
  viewBox
}: GraphCanvasProps): ReactElement {
  const pointByPath = useMemo(() => new Map(points.map((point) => [point.path, point])), [points]);
  const isLargeGraph = points.length > 220 || edges.length > 520;
  const svgClassName = [
    "graph-svg",
    isPanning ? "graph-svg--panning" : "",
    isLargeGraph ? "graph-svg--large" : ""
  ].filter(Boolean).join(" ");

  return (
    <svg
      className={svgClassName}
      onKeyDown={onGraphKeyDown}
      onPointerCancel={onGraphPointerCancel}
      onPointerDown={onGraphPointerDown}
      onPointerMove={onGraphPointerMove}
      onPointerUp={onGraphPointerUp}
      onWheel={onGraphWheel}
      ref={svgRef}
      role="img"
      tabIndex={0}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
    >
      {showArrows ? <GraphArrowMarkers /> : null}
      <g>
        <GraphEdgeLayer
          edges={edges}
          focusedPath={focusedPath}
          isMotionAfterglow={isMotionAfterglow}
          linkThickness={linkThickness}
          motionEpoch={motionEpoch}
          motionPath={motionPath}
          pointByPath={pointByPath}
          showArrows={showArrows}
        />
        <GraphNodeLayer
          focusedPath={focusedPath}
          groupByPath={groupByPath}
          isMotionAfterglow={isMotionAfterglow}
          labelOpacity={labelOpacity}
          motionPath={motionPath}
          nodeSize={nodeSize}
          onNodeClick={onNodeClick}
          onNodeKeyDown={onNodeKeyDown}
          onNodePointerCancel={onNodePointerCancel}
          onNodePointerDown={onNodePointerDown}
          onNodePointerEnter={onNodePointerEnter}
          onNodePointerLeave={onNodePointerLeave}
          onNodePointerMove={onNodePointerMove}
          onNodePointerUp={onNodePointerUp}
          points={points}
          relatedPaths={relatedPaths}
          selectedPath={selectedPath}
          showLabels={showLabels}
        />
      </g>
    </svg>
  );
}
