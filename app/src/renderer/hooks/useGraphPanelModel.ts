import { useEffect, useMemo } from "react";

import {
  buildFilteredGraph,
  buildGroupByPath,
  clamp
} from "../graphLayout";
import type { GraphForceSettings, GraphViewModel } from "../graphLayout";
import type { GraphGroup } from "../store/graphStore";
import { useGraphStore } from "../store/graphStore";
import { useGraphCanvasInteractions } from "./useGraphCanvasInteractions";

interface UseGraphPanelModelInput {
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  workspaceId: string | null;
}

export interface GraphPanelModel {
  animationEpoch: number;
  error: string | null;
  filteredGraph: GraphViewModel;
  focusedPath: string | null;
  graphCanvas: ReturnType<typeof useGraphCanvasInteractions>;
  groupByPath: Map<string, GraphGroup>;
  isMotionAfterglow: boolean;
  isLoading: boolean;
  labelOpacity: number;
  linkThickness: number;
  motionEpoch: number;
  motionPath: string | null;
  nodeSize: number;
  selectedPath: string | null;
  showArrows: boolean;
  showLabels: boolean;
}

export function useGraphPanelModel({
  activeFilePath,
  onOpenFile,
  workspaceId
}: UseGraphPanelModelInput): GraphPanelModel {
  const {
    centerForce,
    error,
    folderFilter,
    graph,
    groups,
    isLoading,
    layoutMode,
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
    zoom,
    animationEpoch
  } = useGraphStore();
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
  const motionPath = null;
  const focusedPath = null;
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
    fitKey: `${layoutMode}\u0000${filteredGraph.signature}`,
    focusedPath,
    forceSettings,
    layoutMode,
    nodes: filteredGraph.nodes,
    onOpenFile,
    selectedPath,
    setFocusedPath: ignoreGraphHover,
    setSelectedPath,
    setZoom,
    zoom
  });

  return {
    animationEpoch,
    error,
    filteredGraph,
    focusedPath,
    graphCanvas,
    groupByPath,
    isMotionAfterglow: false,
    isLoading,
    labelOpacity,
    linkThickness,
    motionEpoch: 0,
    motionPath,
    nodeSize,
    selectedPath,
    showArrows,
    showLabels
  };
}

function ignoreGraphHover(): void {
  return undefined;
}
