import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import {
  GRAPH_SIMULATION_THROTTLE_FRAME_INTERVAL,
  GRAPH_SIMULATION_THROTTLE_NODE_THRESHOLD,
  GRAPH_WORKER_SIMULATION_NODE_THRESHOLD,
  layoutGraph,
  tickGraphSimulation
} from "../graphLayout";
import type { GraphForceSettings, GraphLayoutMode, GraphSimPoint } from "../graphLayout";
import type {
  GraphSimulationWorkerRequest,
  GraphSimulationWorkerResponse
} from "../graphSimulationWorkerTypes";

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

function createGraphSimulationWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;

  try {
    return new Worker(new URL("../workers/graphSimulationWorker.ts", import.meta.url), {
      type: "module"
    });
  } catch {
    return null;
  }
}

function graphSimulationFrameInterval(nodeCount: number): number {
  return nodeCount > GRAPH_SIMULATION_THROTTLE_NODE_THRESHOLD
    ? GRAPH_SIMULATION_THROTTLE_FRAME_INTERVAL
    : 1;
}

function graphSimulationWorkerTickCount(nodeCount: number, responseCount: number): number {
  if (nodeCount <= GRAPH_SIMULATION_THROTTLE_NODE_THRESHOLD) return 1;
  return responseCount < 10 ? 2 : 1;
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

  function updateSimulationPoints(nextPoints: GraphSimPoint[]): void {
    pointsRef.current = nextPoints;
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

    let frameId = 0;
    let frameCount = 0;
    let isActive = true;
    let latestRunId = 0;
    let workerResponseCount = 0;
    let workerBusy = false;
    let worker = nodes.length > GRAPH_WORKER_SIMULATION_NODE_THRESHOLD
      ? createGraphSimulationWorker()
      : null;
    const frameInterval = graphSimulationFrameInterval(nodes.length);

    if (worker) {
      worker.onmessage = (event: MessageEvent<GraphSimulationWorkerResponse>) => {
        if (!isActive) return;
        workerBusy = false;
        if (event.data.runId !== latestRunId) return;
        if (pauseSimulationRef.current) return;
        workerResponseCount += 1;
        updateSimulationPoints(event.data.points);
      };
      worker.onerror = () => {
        if (!isActive) return;
        worker?.terminate();
        worker = null;
        workerBusy = false;
      };
    }

    function tick(): void {
      if (pauseSimulationRef.current) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      frameCount += 1;
      if (frameCount % frameInterval === 0) {
        if (worker) {
          if (!workerBusy) {
            latestRunId += 1;
            workerBusy = true;
            const request: GraphSimulationWorkerRequest = {
              edges,
              forceSettings,
              pinnedPath: pinnedPathRef.current,
              points: pointsRef.current,
              runId: latestRunId,
              tickCount: graphSimulationWorkerTickCount(nodes.length, workerResponseCount)
            };
            worker.postMessage(request);
          }
        } else {
          const nextPoints = tickGraphSimulation(
            pointsRef.current,
            edges,
            forceSettings,
            pinnedPathRef.current
          );
          updateSimulationPoints(nextPoints);
        }
      }

      frameId = window.requestAnimationFrame(tick);
    }

    frameId = window.requestAnimationFrame(tick);
    return () => {
      isActive = false;
      window.cancelAnimationFrame(frameId);
      worker?.terminate();
    };
  }, [edges, forceSettings, nodes.length, pauseSimulationRef, pinnedPathRef]);

  return {
    points,
    pointsRef,
    setPoints
  };
}
