import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import {
  layoutGraph,
  tickGraphSimulation
} from "../graphLayout";
import type { GraphForceSettings, GraphSimPoint } from "../graphLayout";

interface UseGraphSimulationInput {
  edges: WorkspaceGraphEdge[];
  forceSettings: GraphForceSettings;
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
  nodes,
  pauseSimulationRef,
  pinnedPathRef
}: UseGraphSimulationInput): GraphSimulationState {
  const pointsRef = useRef<GraphSimPoint[]>([]);
  const [points, setPointsState] = useState<GraphSimPoint[]>([]);

  function setPoints(nextPoints: GraphSimPoint[]): void {
    pointsRef.current = nextPoints;
    setPointsState(nextPoints);
  }

  useEffect(() => {
    const seedPoints = layoutGraph(nodes, edges, forceSettings);
    const existingPoints = new Map(pointsRef.current.map((point) => [point.path, point]));
    const nextPoints = seedPoints.map((point) => {
      const existing = existingPoints.get(point.path);
      return {
        ...point,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        x: existing?.x ?? point.x,
        y: existing?.y ?? point.y
      };
    });

    setPoints(nextPoints);
  }, [edges, forceSettings, nodes]);

  useEffect(() => {
    if (nodes.length === 0) return;

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
