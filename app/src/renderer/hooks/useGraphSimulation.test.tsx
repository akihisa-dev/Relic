import { act, renderHook, waitFor } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import type { GraphForceSettings, GraphSimPoint } from "../graphLayout";
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

  it("力設定変更時は既存座標から短時間settleして反映する", async () => {
    const { hook, pauseSimulationRef, pinnedPathRef } = renderSimulation();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });
    act(() => {
      hook.result.current.setPoints(hook.result.current.points.map((point, index) => ({
        ...point,
        vx: 0,
        vy: 0,
        x: index === 0 ? 700 : 900,
        y: 450
      })));
    });
    hook.rerender({
      edges,
      forceSettings: { ...forceSettings, linkDistance: 60, repelForce: 1.6 },
      layoutMode: "standard",
      nodes,
      pauseSimulationRef,
      pinnedPathRef
    });

    await waitFor(() => {
      const [a, b] = hook.result.current.points;
      expect(a?.x).not.toBe(700);
      expect(b?.x).not.toBe(900);
    });
  });

  it("RAFやworkerによる継続simulationを開始しない", async () => {
    const requestAnimationFrame = vi.fn();
    const Worker = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("Worker", Worker);

    try {
      const { hook } = renderSimulation();

      await waitFor(() => {
        expect(hook.result.current.points).toHaveLength(2);
      });

      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(Worker).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("setPointsで手動更新した座標をstateとrefへ反映する", async () => {
    const { hook } = renderSimulation();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });
    const nextPoints: GraphSimPoint[] = hook.result.current.points.map((point) => point.path === "A.md"
      ? { ...point, x: point.x + 20 }
      : point
    );

    act(() => {
      hook.result.current.setPoints(nextPoints);
    });

    expect(hook.result.current.points).toBe(nextPoints);
    expect(hook.result.current.pointsRef.current).toBe(nextPoints);
  });
});
