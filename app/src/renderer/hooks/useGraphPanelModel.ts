import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildFilteredGraph,
  buildGroupByPath,
  clamp
} from "../graphLayout";
import type { GraphForceSettings, GraphViewModel } from "../graphLayout";
import type { GraphGroup } from "../store/graphStore";
import { useGraphStore } from "../store/graphStore";
import { useGraphCanvasInteractions } from "./useGraphCanvasInteractions";

export const GRAPH_AFTERGLOW_DURATION_MS = 1000;

interface UseGraphPanelModelInput {
  activeFilePath: string | null;
  workspaceId: string | null;
}

export interface GraphPanelModel {
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
  workspaceId
}: UseGraphPanelModelInput): GraphPanelModel {
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
  const hoveredPathRef = useRef<string | null>(null);
  const afterglowTimerRef = useRef<number | null>(null);
  const [afterglowPath, setAfterglowPath] = useState<string | null>(null);
  const [motionEpoch, setMotionEpoch] = useState(0);

  const clearAfterglowTimer = useCallback((): void => {
    if (afterglowTimerRef.current === null) return;
    window.clearTimeout(afterglowTimerRef.current);
    afterglowTimerRef.current = null;
  }, []);

  useEffect(() => () => clearAfterglowTimer(), [clearAfterglowTimer]);

  useEffect(() => {
    loadGraph(workspaceId);
  }, [loadGraph, workspaceId]);

  const setMotionFocusedPath = useCallback((next: string | null | ((current: string | null) => string | null)): void => {
    const current = hoveredPathRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved === current) return;

    clearAfterglowTimer();
    if (resolved) {
      hoveredPathRef.current = resolved;
      setHoveredPath(resolved);
      setAfterglowPath(null);
      setMotionEpoch((epoch) => epoch + 1);
      return;
    }

    hoveredPathRef.current = null;
    setHoveredPath(null);
    if (!current) {
      setAfterglowPath(null);
      return;
    }

    setAfterglowPath(current);
    setMotionEpoch((epoch) => epoch + 1);
    afterglowTimerRef.current = window.setTimeout(() => {
      setAfterglowPath((path) => path === current ? null : path);
      afterglowTimerRef.current = null;
    }, GRAPH_AFTERGLOW_DURATION_MS);
  }, [clearAfterglowTimer]);

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
  const motionPath = hoveredPath ?? afterglowPath;
  const focusedPath = motionPath ?? selectedPath;
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
    selectedPath,
    setFocusedPath: setMotionFocusedPath,
    setSelectedPath,
    setZoom,
    zoom
  });

  return {
    error,
    filteredGraph,
    focusedPath,
    graphCanvas,
    groupByPath,
    isMotionAfterglow: !hoveredPath && !!afterglowPath,
    isLoading,
    labelOpacity,
    linkThickness,
    motionEpoch,
    motionPath,
    nodeSize,
    selectedPath,
    showArrows,
    showLabels
  };
}
