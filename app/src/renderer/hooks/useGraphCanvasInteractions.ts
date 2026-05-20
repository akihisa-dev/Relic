import { useMemo, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { collectRelatedGraphPaths } from "../graphLayout";
import type { GraphForceSettings, GraphLayoutMode, GraphSimPoint, GraphViewBox } from "../graphLayout";
import { useGraphNodeInteractions } from "./useGraphNodeInteractions";
import type { GraphNodeHandlers } from "./useGraphNodeInteractions";
import { useGraphSimulation } from "./useGraphSimulation";
import { useGraphViewportInteractions } from "./useGraphViewportInteractions";
import type { GraphHandlers, GraphViewportController } from "./useGraphViewportInteractions";

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
  pointsRef: MutableRefObject<GraphSimPoint[]>;
  relatedPaths: Set<string>;
  surfaceRef: RefObject<HTMLDivElement | null>;
  viewportController: GraphViewportController;
  viewBox: GraphViewBox;
} {
  const pinnedPathRef = useRef<string | null>(null);
  const pauseSimulationRef = useRef(false);
  const simulation = useGraphSimulation({
    edges,
    forceSettings,
    layoutMode,
    nodes,
    pauseSimulationRef,
    pinnedPathRef: pinnedPathRef as MutableRefObject<string | null>
  });
  const fitKey = useMemo(() => {
    const nodeKey = nodes.map((node) => node.path).join("\u0000");
    const edgeKey = edges.map((edge) => `${edge.sourcePath}->${edge.targetPath}`).join("\u0000");
    return `${layoutMode}\u0000${nodeKey}\u0000${edgeKey}`;
  }, [edges, layoutMode, nodes]);
  const viewport = useGraphViewportInteractions({
    fitKey,
    onBackgroundClick: () => setSelectedPath(null),
    pauseSimulationRef,
    points: simulation.points,
    setZoom,
    zoom
  });
  const nodeHandlers = useGraphNodeInteractions({
    edges,
    forceSettings,
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
    pointsRef: simulation.pointsRef,
    relatedPaths,
    surfaceRef: viewport.surfaceRef,
    viewportController: viewport.viewportController,
    viewBox: viewport.viewBox
  };
}
