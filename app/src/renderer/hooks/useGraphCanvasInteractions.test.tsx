import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { GRAPH_HEIGHT, GRAPH_PADDING, GRAPH_WIDTH } from "../graphLayout";
import { useGraphCanvasInteractions } from "./useGraphCanvasInteractions";

const nodes: WorkspaceGraphNode[] = [
  { folder: "", name: "A", path: "A.md", tags: [] },
  { folder: "", name: "B", path: "B.md", tags: [] }
];

const edges: WorkspaceGraphEdge[] = [
  { sourcePath: "A.md", targetPath: "B.md" }
];

const forceSettings = {
  centerForce: 1,
  linkDistance: 118,
  linkForce: 1,
  repelForce: 1
};

function makeEvent<T extends Element>(overrides: Partial<{
  button: number;
  clientX: number;
  clientY: number;
  currentTarget: T;
  deltaY: number;
  key: string;
  pointerId: number;
  preventDefault: () => void;
  shiftKey: boolean;
  stopPropagation: () => void;
  target: Element;
}> = {}): never {
  const currentTarget = overrides.currentTarget ?? ({
    hasPointerCapture: vi.fn().mockReturnValue(true),
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn()
  } as unknown as T);
  const target = overrides.target ?? ({ closest: vi.fn().mockReturnValue(null) } as unknown as Element);

  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    currentTarget,
    deltaY: 0,
    key: "",
    pointerId: 1,
    preventDefault: vi.fn(),
    shiftKey: false,
    stopPropagation: vi.fn(),
    target,
    ...overrides
  } as never;
}

function renderInteractions(overrides: Partial<Parameters<typeof useGraphCanvasInteractions>[0]> = {}) {
  const onOpenFile = vi.fn();
  const setFocusedPath = vi.fn();
  const setSelectedPath = vi.fn();
  const setZoom = vi.fn();
  const hook = renderHook((props: Parameters<typeof useGraphCanvasInteractions>[0]) => useGraphCanvasInteractions(props), {
    initialProps: {
      edges,
      focusedPath: null,
      forceSettings,
      nodes,
      onOpenFile,
      selectedPath: null,
      setFocusedPath,
      setSelectedPath,
      setZoom,
      zoom: 1,
      ...overrides
    }
  });

  return { hook, onOpenFile, setFocusedPath, setSelectedPath, setZoom };
}

describe("useGraphCanvasInteractions", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初期化後にlayout済みpointsとviewBoxを返す", async () => {
    const { hook } = renderInteractions();

    await waitFor(() => {
      expect(hook.result.current.points).toHaveLength(2);
    });

    expect(hook.result.current.points.map((point) => point.path)).toEqual(["A.md", "B.md"]);
    expect(hook.result.current.viewBox).toEqual({
      height: 520,
      width: 720,
      x: 0,
      y: 0
    });
  });

  it("wheel操作でzoom更新callbackを呼ぶ", () => {
    const { hook, setZoom } = renderInteractions();

    act(() => {
      hook.result.current.graphHandlers.onWheel(makeEvent<SVGSVGElement>({ deltaY: -100 }));
    });

    expect(setZoom).toHaveBeenCalledWith(1.1);
  });

  it("node clickでは選択だけ更新し、focus演出状態は変更しない", async () => {
    const { hook, onOpenFile, setFocusedPath, setSelectedPath } = renderInteractions();

    await waitFor(() => {
      expect(hook.result.current.points[0]).toBeDefined();
    });

    act(() => {
      hook.result.current.nodeHandlers.onClick(hook.result.current.points[0]);
    });

    expect(setSelectedPath).toHaveBeenCalledWith("A.md");
    expect(setFocusedPath).not.toHaveBeenCalled();
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("Enter keyとSpace keyはいずれも選択のみを実行する", async () => {
    const { hook, onOpenFile, setSelectedPath } = renderInteractions();

    await waitFor(() => {
      expect(hook.result.current.points[0]).toBeDefined();
    });

    act(() => {
      hook.result.current.nodeHandlers.onKeyDown(makeEvent<SVGGElement>({ key: "Enter" }), hook.result.current.points[0]);
      hook.result.current.nodeHandlers.onKeyDown(makeEvent<SVGGElement>({ key: " " }), hook.result.current.points[1]);
    });

    expect(setSelectedPath).toHaveBeenCalledWith("A.md");
    expect(setSelectedPath).toHaveBeenCalledWith("B.md");
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("node drag中のmoveで対象node座標をbounds内で更新する", async () => {
    const { hook } = renderInteractions();

    await waitFor(() => {
      expect(hook.result.current.points[0]).toBeDefined();
    });

    const firstPoint = hook.result.current.points[0];
    const nodeTarget = {
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as SVGGElement;
    const svgTarget = {
      getBoundingClientRect: () => ({ height: 520, width: 720 } as DOMRect)
    } as unknown as SVGSVGElement;
    (hook.result.current.svgRef as { current: SVGSVGElement | null }).current = svgTarget;

    act(() => {
      hook.result.current.nodeHandlers.onPointerDown(
        makeEvent<SVGGElement>({
          clientX: 10,
          clientY: 10,
          currentTarget: nodeTarget,
          pointerId: 7
        }),
        firstPoint
      );
      hook.result.current.nodeHandlers.onPointerMove(
        makeEvent<SVGGElement>({
          clientX: 5000,
          clientY: 5000,
          currentTarget: nodeTarget,
          pointerId: 7
        })
      );
    });

    const movedPoint = hook.result.current.points.find((point) => point.path === firstPoint.path);
    expect(movedPoint?.x).toBeLessThanOrEqual(GRAPH_WIDTH - GRAPH_PADDING);
    expect(movedPoint?.y).toBeLessThanOrEqual(GRAPH_HEIGHT - GRAPH_PADDING);
    expect(movedPoint?.x).toBeGreaterThanOrEqual(GRAPH_PADDING);
    expect(movedPoint?.y).toBeGreaterThanOrEqual(GRAPH_PADDING);
  });
});
