import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import {
  GRAPH_SIMULATION_THROTTLE_NODE_THRESHOLD,
  GRAPH_WORKER_SIMULATION_NODE_THRESHOLD,
  type GraphForceSettings,
  type GraphSimPoint
} from "../graphLayout";
import type { GraphSimulationWorkerResponse } from "../graphSimulationWorkerTypes";
import { useGraphSimulation } from "./useGraphSimulation";

const nodes: WorkspaceGraphNode[] = [
  { folder: "", name: "A", path: "A.md", tags: [] },
  { folder: "", name: "B", path: "B.md", tags: [] }
];

const edges: WorkspaceGraphEdge[] = [
  { sourcePath: "A.md", targetPath: "B.md" }
];

const forceSettings: GraphForceSettings = {
  centerForce: 1,
  linkDistance: 118,
  linkForce: 1,
  repelForce: 1
};

function renderSimulation(overrides: Partial<Parameters<typeof useGraphSimulation>[0]> = {}) {
  const pauseSimulationRef: MutableRefObject<boolean> = { current: false };
  const pinnedPathRef: MutableRefObject<string | null> = { current: null };
  const hook = renderHook((props: Parameters<typeof useGraphSimulation>[0]) => useGraphSimulation(props), {
    initialProps: {
      edges,
      forceSettings,
      layoutMode: "standard",
      nodes,
      pauseSimulationRef,
      pinnedPathRef,
      ...overrides
    }
  });

  return { hook, pauseSimulationRef, pinnedPathRef };
}

describe("useGraphSimulation", () => {
  let frameCallbacks: FrameRequestCallback[];
  let workerInstances: MockGraphSimulationWorker[];

  class MockGraphSimulationWorker {
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessage: ((event: MessageEvent<GraphSimulationWorkerResponse>) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      workerInstances.push(this);
    }

    emitResponse(points: GraphSimPoint[], runId = 1): void {
      this.onmessage?.({ data: { points, runId } } as MessageEvent<GraphSimulationWorkerResponse>);
    }

    emitError(): void {
      this.onerror?.(new ErrorEvent("error"));
    }
  }

  beforeEach(() => {
    frameCallbacks = [];
    workerInstances = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("Worker", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初期化後にlayout済みpointsを返す", async () => {
    const { hook } = renderSimulation();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });

    expect(hook.result.current.points.map((point) => point.path)).toEqual(["A.md", "B.md"]);
  });

  it("layout再計算時に既存座標を維持する", async () => {
    const { hook } = renderSimulation();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });
    act(() => {
      hook.result.current.setPoints(hook.result.current.points.map((point) => point.path === "A.md"
        ? { ...point, x: 123, y: 234, vx: 3, vy: 4 }
        : point
      ));
    });
    hook.rerender({
      edges: [...edges],
      forceSettings,
      layoutMode: "standard",
      nodes: nodes.map((node) => ({ ...node })),
      pauseSimulationRef: { current: false },
      pinnedPathRef: { current: null }
    });

    await waitFor(() => {
      expect(hook.result.current.points.find((point) => point.path === "A.md")).toMatchObject({
        vx: 3,
        vy: 4,
        x: 123,
        y: 234
      });
    });
  });

  it("layout mode変更時は新しい配置で再シードする", async () => {
    const { hook } = renderSimulation();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });
    act(() => {
      hook.result.current.setPoints(hook.result.current.points.map((point) => point.path === "A.md"
        ? { ...point, x: 123, y: 234, vx: 3, vy: 4 }
        : point
      ));
    });
    hook.rerender({
      edges,
      forceSettings,
      layoutMode: "scatter",
      nodes,
      pauseSimulationRef: { current: false },
      pinnedPathRef: { current: null }
    });

    await waitFor(() => {
      const movedPoint = hook.result.current.points.find((point) => point.path === "A.md");
      expect(movedPoint?.x).not.toBe(123);
      expect(movedPoint?.y).not.toBe(234);
      expect(movedPoint?.vx).toBe(0);
      expect(movedPoint?.vy).toBe(0);
    });
  });

  it("RAF tickでsimulationを更新する", async () => {
    const { hook } = renderSimulation();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });
    const before = hook.result.current.points;

    act(() => {
      frameCallbacks[0]?.(0);
    });

    expect(hook.result.current.points).not.toBe(before);
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("pinned nodeをtick中に動かさない", async () => {
    const pinnedPathRef: MutableRefObject<string | null> = { current: "A.md" };
    const { hook } = renderSimulation({ pinnedPathRef });

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });
    const before = hook.result.current.points.find((point) => point.path === "A.md");

    act(() => {
      frameCallbacks[0]?.(0);
    });

    const after = hook.result.current.points.find((point) => point.path === "A.md");
    expect(after?.x).toBe(before?.x);
    expect(after?.y).toBe(before?.y);
  });

  it("大規模グラフではworkerへsimulation tickを依頼し、返却pointsを反映する", async () => {
    vi.stubGlobal("Worker", MockGraphSimulationWorker);
    const manyNodes = Array.from({ length: GRAPH_SIMULATION_THROTTLE_NODE_THRESHOLD + 1 }, (_, index) => ({
      folder: "",
      name: `N${index}`,
      path: `N${index}.md`,
      tags: []
    }));

    const { hook } = renderSimulation({ edges: [], nodes: manyNodes });

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(manyNodes.length);
    });

    act(() => {
      frameCallbacks[0]?.(0);
      frameCallbacks[1]?.(16);
    });

    expect(workerInstances).toHaveLength(1);
    expect(workerInstances[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({
      edges: [],
      forceSettings,
      pinnedPath: null,
      runId: 1,
      tickCount: 2
    }));

    const nextPoints = hook.result.current.points.map((point, index) => index === 0
      ? { ...point, x: point.x + 10 }
      : point
    );
    act(() => {
      workerInstances[0].emitResponse(nextPoints, 1);
    });

    expect(hook.result.current.points[0].x).toBe(nextPoints[0].x);
  });

  it("worker error後はmain-thread simulationへfallbackする", async () => {
    vi.stubGlobal("Worker", MockGraphSimulationWorker);
    const manyNodes = Array.from({ length: GRAPH_WORKER_SIMULATION_NODE_THRESHOLD + 1 }, (_, index) => ({
      folder: "",
      name: `N${index}`,
      path: `N${index}.md`,
      tags: []
    }));

    const { hook } = renderSimulation({ edges: [], nodes: manyNodes });

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(manyNodes.length);
    });
    act(() => {
      frameCallbacks[0]?.(0);
      workerInstances[0].emitError();
    });
    const beforeFallback = hook.result.current.points;

    act(() => {
      frameCallbacks[1]?.(16);
    });

    expect(workerInstances[0].terminate).toHaveBeenCalled();
    expect(hook.result.current.points).not.toBe(beforeFallback);
  });

  it("unmount時にworkerをterminateする", async () => {
    vi.stubGlobal("Worker", MockGraphSimulationWorker);
    const manyNodes = Array.from({ length: GRAPH_WORKER_SIMULATION_NODE_THRESHOLD + 1 }, (_, index) => ({
      folder: "",
      name: `N${index}`,
      path: `N${index}.md`,
      tags: []
    }));

    const { hook } = renderSimulation({ edges: [], nodes: manyNodes });

    await waitFor(() => {
      expect(workerInstances).toHaveLength(1);
    });
    hook.unmount();

    expect(workerInstances[0].terminate).toHaveBeenCalled();
  });
});
