import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import {
  GRAPH_LIVE_SIMULATION_NODE_LIMIT,
  layoutGraph,
  tickGraphSimulation
} from "../graphLayout";
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
  points: GraphSimPoint[];
  pointsRef: MutableRefObject<GraphSimPoint[]>;
  setPoints: (points: GraphSimPoint[]) => void;
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
  const layoutModeRef = useRef<GraphLayoutMode | null>(null);
  const [points, setPointsState] = useState<GraphSimPoint[]>([]);

  function setPoints(nextPoints: GraphSimPoint[]): void {
    pointsRef.current = nextPoints;
    setPointsState(nextPoints);
  }

  useEffect(() => {
    const seedPoints = layoutGraph(nodes, edges, forceSettings, layoutMode);
    const existingPoints = new Map(pointsRef.current.map((point) => [point.path, point]));
    const shouldReuseExistingPoints = layoutModeRef.current === layoutMode;
    const nextPoints = seedPoints.map((point) => {
      const existing = existingPoints.get(point.path);
      return {
        ...point,
        vx: shouldReuseExistingPoints ? existing?.vx ?? 0 : 0,
        vy: shouldReuseExistingPoints ? existing?.vy ?? 0 : 0,
        x: shouldReuseExistingPoints ? existing?.x ?? point.x : point.x,
        y: shouldReuseExistingPoints ? existing?.y ?? point.y : point.y
      };
    });

    layoutModeRef.current = layoutMode;
    setPoints(nextPoints);
  }, [edges, forceSettings, layoutMode, nodes]);

  useEffect(() => {
    if (nodes.length === 0) return;
    if (nodes.length > GRAPH_LIVE_SIMULATION_NODE_LIMIT) return;

    let frameId = 0;

    function tick(): void {
      if (pauseSimulationRef.current) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      const nextPoints = tickGraphSimulation(
        pointsRef.current,
        edges,
        forceSettings,
        pinnedPathRef.current
      );
      setPoints(nextPoints);

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [edges, forceSettings, nodes.length, pauseSimulationRef, pinnedPathRef]);

  return {
    points,
    pointsRef,
    setPoints
  };
}
