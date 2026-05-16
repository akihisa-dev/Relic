import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import type { GraphForceSettings } from "../graphLayout";
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

  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
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
});
