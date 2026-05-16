import { useMemo } from "react";
import type { KeyboardEvent, PointerEvent, ReactElement, RefObject, WheelEvent } from "react";

import type { WorkspaceGraphEdge } from "../../shared/ipc";
import type { GraphPoint, GraphViewBox } from "../graphLayout";
import type { GraphGroup } from "../store/graphStore";

export interface GraphCanvasProps {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  groupByPath: Map<string, GraphGroup>;
  isPanning: boolean;
  labelOpacity: number;
  linkThickness: number;
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
  isPanning,
  labelOpacity,
  linkThickness,
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

  return (
    <svg
      className={isPanning ? "graph-svg graph-svg--panning" : "graph-svg"}
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
          {edges.map((edge) => {
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
                onClick={() => onNodeClick(point)}
                onPointerEnter={() => onNodePointerEnter(point.path)}
                onPointerCancel={onNodePointerCancel}
                onPointerDown={(event) => onNodePointerDown(event, point)}
                onPointerMove={onNodePointerMove}
                onPointerUp={(event) => onNodePointerUp(event, point)}
                onPointerLeave={() => onNodePointerLeave(point.path)}
                onKeyDown={(event) => onNodeKeyDown(event, point)}
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
  );
}
