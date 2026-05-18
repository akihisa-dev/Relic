import { Fragment } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactElement } from "react";

import type { WorkspaceGraphEdge } from "../../shared/ipc";
import { GRAPH_VISIBLE_LABEL_NODE_LIMIT, type GraphPoint } from "../graphLayout";
import type { GraphGroup } from "../store/graphStore";

export function GraphArrowMarkers(): ReactElement {
  return (
    <defs>
      <marker id="graph-arrow" markerHeight="8" markerUnits="userSpaceOnUse" markerWidth="8" orient="auto" refX="8" refY="4">
        <path className="graph-arrow-marker" d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
      <marker id="graph-arrow-selected" markerHeight="8" markerUnits="userSpaceOnUse" markerWidth="8" orient="auto" refX="8" refY="4">
        <path className="graph-arrow-marker graph-arrow-marker--selected" d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
    </defs>
  );
}

export function GraphEdgeLayer({
  edges,
  focusedPath,
  linkThickness,
  isMotionAfterglow,
  motionEpoch,
  motionPath,
  pointByPath,
  showArrows
}: {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  isMotionAfterglow: boolean;
  linkThickness: number;
  motionEpoch: number;
  motionPath: string | null;
  pointByPath: Map<string, GraphPoint>;
  showArrows: boolean;
}): ReactElement {
  return (
    <g className="graph-edge-layer">
      {edges.map((edge) => {
        const source = pointByPath.get(edge.sourcePath);
        const target = pointByPath.get(edge.targetPath);
        if (!source || !target) return null;
        const isFocused = focusedPath === edge.sourcePath || focusedPath === edge.targetPath;
        const isMotionEdge = motionPath === edge.sourcePath || motionPath === edge.targetPath;
        const className = [
          "graph-edge",
          isFocused ? "graph-edge--selected" : "",
          focusedPath && !isFocused ? "graph-edge--dimmed" : ""
        ].filter(Boolean).join(" ");
        return (
          <Fragment key={`${edge.sourcePath}-${edge.targetPath}`}>
            <line
              className={className}
              markerEnd={showArrows ? `url(#${isFocused ? "graph-arrow-selected" : "graph-arrow"})` : undefined}
              style={{ strokeWidth: (isFocused ? 1.6 : 0.9) * linkThickness }}
              x1={source.x}
              x2={target.x}
              y1={source.y}
              y2={target.y}
            />
            {isMotionEdge ? (
              <line
                className={[
                  "graph-edge-trace",
                  isMotionAfterglow ? "graph-edge-trace--afterglow" : ""
                ].filter(Boolean).join(" ")}
                key={`${edge.sourcePath}-${edge.targetPath}-${motionEpoch}`}
                pathLength={1}
                style={{ strokeWidth: Math.max(1.4, 1.8 * linkThickness) }}
                x1={source.x}
                x2={target.x}
                y1={source.y}
                y2={target.y}
              />
            ) : null}
          </Fragment>
        );
      })}
    </g>
  );
}

export function GraphNodeLayer({
  focusedPath,
  groupByPath,
  isMotionAfterglow,
  labelOpacity,
  motionPath,
  nodeSize,
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
  showLabels
}: {
  focusedPath: string | null;
  groupByPath: Map<string, GraphGroup>;
  isMotionAfterglow: boolean;
  labelOpacity: number;
  motionPath: string | null;
  nodeSize: number;
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
  showLabels: boolean;
}): ReactElement {
  return (
    <g className="graph-node-layer">
      {points.map((point, index) => {
        const isSelected = point.path === selectedPath;
        const isRelated = relatedPaths.has(point.path);
        const isFocused = point.path === focusedPath;
        const isMotionNode = point.path === motionPath;
        const group = groupByPath.get(point.path);
        const radius = Math.min(8, 2.6 + Math.sqrt(point.degree) * 1.45) * nodeSize;
        const nodeClassName = [
          "graph-node",
          isSelected ? "graph-node--selected" : "",
          isFocused && !isSelected ? "graph-node--focused" : "",
          focusedPath && !isRelated ? "graph-node--dimmed" : "",
          focusedPath && isRelated && !isSelected && !isFocused ? "graph-node--related" : "",
          isMotionNode ? "graph-node--motion" : "",
          isMotionNode && isMotionAfterglow ? "graph-node--motion-afterglow" : ""
        ].filter(Boolean).join(" ");
        const labelClassName = focusedPath && !isRelated ? "graph-label graph-label--dimmed" : "graph-label";
        const shouldShowLabel = showLabels && (
          points.length <= GRAPH_VISIBLE_LABEL_NODE_LIMIT ||
          isSelected ||
          isFocused ||
          (focusedPath !== null && isRelated)
        );
        const nodeStyle: CSSProperties = {
          animationDelay: `${-(index % 9) * 0.44}s`,
          ...(group ? { fill: group.color } : {})
        };

        return (
          <g
            aria-label={point.name}
            className="graph-node-hit"
            key={point.path}
            onClick={() => onNodeClick(point)}
            onBlur={() => onNodePointerLeave(point.path)}
            onFocus={() => onNodePointerEnter(point.path)}
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
            {isSelected ? (
              <circle
                aria-hidden="true"
                className="graph-node-selection-ring"
                cx={point.x}
                cy={point.y}
                r={radius + 5}
              />
            ) : null}
            <circle
              className={nodeClassName}
              cx={point.x}
              cy={point.y}
              r={radius}
              style={nodeStyle}
            />
            {shouldShowLabel ? (
              <text className={labelClassName} style={{ opacity: labelOpacity }} x={point.x + radius + 5} y={point.y + 4}>{point.name}</text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}
