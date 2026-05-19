import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { layoutGraph, tickGraphSimulation } from "../graphLayout";
import type { GraphForceSettings, GraphLayoutMode, GraphSimPoint } from "../graphLayout";

interface UseGraphSimulationInput {
  animationEpoch: number;
  edges: WorkspaceGraphEdge[];
  forceSettings: GraphForceSettings;
  layoutMode: GraphLayoutMode;
  nodes: WorkspaceGraphNode[];
  pauseSimulationRef: MutableRefObject<boolean>;
  pinnedPathRef: MutableRefObject<string | null>;
}

export interface GraphSimulationState {
  points: GraphSimPoint[];
  pointsRef: MutableRefObject<GraphSimPoint[]>;
  setPoints: (points: GraphSimPoint[]) => void;
}

export function useGraphSimulation({
  animationEpoch = 0,
  edges,
  forceSettings,
  layoutMode,
  nodes,
  pauseSimulationRef,
  pinnedPathRef
}: UseGraphSimulationInput): GraphSimulationState {
  const pointsRef = useRef<GraphSimPoint[]>([]);
  const forceSettingsKeyRef = useRef<string | null>(null);
  const animationEpochRef = useRef(animationEpoch);
  const layoutModeRef = useRef<GraphLayoutMode | null>(null);
  const [points, setPointsState] = useState<GraphSimPoint[]>([]);

  function setPoints(nextPoints: GraphSimPoint[]): void {
    pointsRef.current = nextPoints;
    setPointsState(nextPoints);
  }

  useEffect(() => {
    const forceSettingsKey = buildForceSettingsKey(forceSettings);
    const didForceSettingsChange = forceSettingsKeyRef.current !== null && forceSettingsKeyRef.current !== forceSettingsKey;
    const didStartAnimation = animationEpochRef.current !== animationEpoch;
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
    const nextPoints = (didForceSettingsChange || didStartAnimation) && !pauseSimulationRef.current
      ? tickGraphSimulation(reusedPoints, edges, forceSettings, pinnedPathRef.current, didStartAnimation ? 72 : 36)
      : reusedPoints;

    forceSettingsKeyRef.current = forceSettingsKey;
    animationEpochRef.current = animationEpoch;
    layoutModeRef.current = layoutMode;
    setPoints(nextPoints);
  }, [animationEpoch, edges, forceSettings, layoutMode, nodes, pauseSimulationRef, pinnedPathRef]);

  return {
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
