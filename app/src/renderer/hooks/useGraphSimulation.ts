import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { layoutGraph, tickGraphSimulation } from "../graphLayout";
import type { GraphForceSettings, GraphLayoutMode, GraphSimPoint } from "../graphLayout";

interface UseGraphSimulationInput {
  edges: WorkspaceGraphEdge[];
  forceSettings: GraphForceSettings;
  layoutMode: GraphLayoutMode;
  nodes: WorkspaceGraphNode[];
  pauseSimulationRef: MutableRefObject<boolean>;
  pinnedPathRef: MutableRefObject<string | null>;
}

export interface GraphSimulationState {
  geometryController: GraphGeometryController;
  points: GraphSimPoint[];
  pointsRef: MutableRefObject<GraphSimPoint[]>;
  setPoints: (points: GraphSimPoint[]) => void;
}

export interface GraphGeometryController {
  changedPathsRef: MutableRefObject<Set<string> | null>;
  livePointsRef: MutableRefObject<GraphSimPoint[]>;
  notifyChanged: (paths: Set<string> | null) => void;
  subscribe: (listener: () => void) => () => void;
}

export function useGraphSimulation({
  edges,
  forceSettings,
  layoutMode,
  nodes,
  pauseSimulationRef,
  pinnedPathRef
}: UseGraphSimulationInput): GraphSimulationState {
  const pointsRef = useRef<GraphSimPoint[]>([]);
  const changedPathsRef = useRef<Set<string> | null>(null);
  const geometryListenersRef = useRef(new Set<() => void>());
  const geometryControllerRef = useRef<GraphGeometryController | null>(null);
  const forceSettingsKeyRef = useRef<string | null>(null);
  const layoutModeRef = useRef<GraphLayoutMode | null>(null);
  const [points, setPointsState] = useState<GraphSimPoint[]>([]);

  if (!geometryControllerRef.current) {
    geometryControllerRef.current = {
      changedPathsRef,
      livePointsRef: pointsRef,
      notifyChanged,
      subscribe
    };
  }

  function setPoints(nextPoints: GraphSimPoint[]): void {
    pointsRef.current = nextPoints;
    setPointsState(nextPoints);
    notifyChanged(null);
  }

  function notifyChanged(paths: Set<string> | null): void {
    if (paths === null) {
      changedPathsRef.current = null;
    } else if (paths.size > 0 && changedPathsRef.current !== null) {
      const nextPaths = changedPathsRef.current ?? new Set<string>();
      paths.forEach((path) => nextPaths.add(path));
      changedPathsRef.current = nextPaths;
    }
    geometryListenersRef.current.forEach((listener) => listener());
  }

  function subscribe(listener: () => void): () => void {
    geometryListenersRef.current.add(listener);
    return () => geometryListenersRef.current.delete(listener);
  }

  useEffect(() => {
    const forceSettingsKey = buildForceSettingsKey(forceSettings);
    const didForceSettingsChange = forceSettingsKeyRef.current !== null && forceSettingsKeyRef.current !== forceSettingsKey;
    const seedPoints = layoutGraph(nodes, edges, forceSettings, layoutMode);
    const existingPoints = new Map(pointsRef.current.map((point) => [point.path, point]));
    const shouldReuseExistingPoints = layoutModeRef.current === layoutMode;
    const reusedPoints = seedPoints.map((point) => {
      const existing = existingPoints.get(point.path);
      return {
        ...point,
        vx: shouldReuseExistingPoints ? existing?.vx ?? 0 : 0,
        vy: shouldReuseExistingPoints ? existing?.vy ?? 0 : 0,
        x: shouldReuseExistingPoints ? existing?.x ?? point.x : point.x,
        y: shouldReuseExistingPoints ? existing?.y ?? point.y : point.y
      };
    });
    const nextPoints = didForceSettingsChange && !pauseSimulationRef.current
      ? tickGraphSimulation(reusedPoints, edges, forceSettings, pinnedPathRef.current, 36)
      : reusedPoints;

    forceSettingsKeyRef.current = forceSettingsKey;
    layoutModeRef.current = layoutMode;
    setPoints(nextPoints);
  }, [edges, forceSettings, layoutMode, nodes, pauseSimulationRef, pinnedPathRef]);

  return {
    geometryController: geometryControllerRef.current,
    points,
    pointsRef,
    setPoints
  };
}

function buildForceSettingsKey(forceSettings: GraphForceSettings): string {
  return [
    forceSettings.centerForce,
    forceSettings.linkDistance,
    forceSettings.linkForce,
    forceSettings.repelForce
  ].join(":");
}
