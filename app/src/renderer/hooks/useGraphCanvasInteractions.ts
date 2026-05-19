import { useMemo, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { collectRelatedGraphPaths } from "../graphLayout";
import type { GraphForceSettings, GraphLayoutMode, GraphSimPoint, GraphViewBox } from "../graphLayout";
import { useGraphNodeInteractions } from "./useGraphNodeInteractions";
import type { GraphNodeHandlers } from "./useGraphNodeInteractions";
import { useGraphSimulation } from "./useGraphSimulation";
import { useGraphViewportInteractions } from "./useGraphViewportInteractions";
import type { GraphHandlers } from "./useGraphViewportInteractions";

interface UseGraphCanvasInteractionsInput {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  forceSettings: GraphForceSettings;
  layoutMode: GraphLayoutMode;
  nodes: WorkspaceGraphNode[];
  onOpenFile: (path: string) => void;
  selectedPath: string | null;
  setFocusedPath: (path: string | null | ((current: string | null) => string | null)) => void;
  setSelectedPath: (path: string | null) => void;
  setZoom: (value: number) => void;
  zoom: number;
}

export type { GraphHandlers } from "./useGraphViewportInteractions";
export type { GraphNodeHandlers } from "./useGraphNodeInteractions";

export function useGraphCanvasInteractions({
  edges,
  focusedPath,
  forceSettings,
  layoutMode,
  nodes,
  onOpenFile,
  selectedPath,
  setFocusedPath,
  setSelectedPath,
  setZoom,
  zoom
}: UseGraphCanvasInteractionsInput): {
  graphHandlers: GraphHandlers;
  isPanning: boolean;
  nodeHandlers: GraphNodeHandlers;
  points: GraphSimPoint[];
  relatedPaths: Set<string>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  viewBox: GraphViewBox;
} {
  const pinnedPathRef = useRef<string | null>(null);
  const viewport = useGraphViewportInteractions({
    onBackgroundClick: () => setSelectedPath(null),
    setZoom,
    zoom
  });
  const simulation = useGraphSimulation({
    edges,
    forceSettings,
    layoutMode,
    nodes,
    pauseSimulationRef: viewport.pauseSimulationRef,
    pinnedPathRef: pinnedPathRef as MutableRefObject<string | null>
  });
  const nodeHandlers = useGraphNodeInteractions({
    getGraphDelta: viewport.getGraphDelta,
    onOpenFile,
    pinnedPathRef: pinnedPathRef as MutableRefObject<string | null>,
    pointsRef: simulation.pointsRef,
    selectedPath,
    setFocusedPath,
    setPoints: simulation.setPoints,
    setSelectedPath
  });
  const relatedPaths = useMemo(() => collectRelatedGraphPaths(edges, focusedPath), [edges, focusedPath]);

  return {
    graphHandlers: viewport.graphHandlers,
    isPanning: viewport.isPanning,
    nodeHandlers,
    points: simulation.points,
    relatedPaths,
    surfaceRef: viewport.surfaceRef,
    viewBox: viewport.viewBox
  };
}
