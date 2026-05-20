import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { GRAPH_HEIGHT, GRAPH_PADDING, GRAPH_WIDTH } from "../graphLayout";
import type { GraphForceSettings, GraphPan, GraphPoint, GraphSimPoint } from "../graphLayout";
import {
  collectGraphNeighborhoodPaths,
  relaxGraphNeighborhood,
  useGraphNodeInteractions
} from "./useGraphNodeInteractions";

const points: GraphSimPoint[] = [
  { degree: 1, folder: "", incoming: 0, name: "A", outgoing: 1, path: "A.md", tags: [], vx: 0, vy: 0, x: 80, y: 90 },
  { degree: 1, folder: "", incoming: 1, name: "B", outgoing: 0, path: "B.md", tags: [], vx: 0, vy: 0, x: 160, y: 130 }
];
const edges = [{ sourcePath: "A.md", targetPath: "B.md" }];
const forceSettings: GraphForceSettings = {
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
  key: string;
  pointerId: number;
  preventDefault: () => void;
  stopPropagation: () => void;
}> = {}): never {
  const currentTarget = overrides.currentTarget ?? ({
    hasPointerCapture: vi.fn().mockReturnValue(true),
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn()
  } as unknown as T);

  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    currentTarget,
    key: "",
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides
  } as never;
}

function renderNodeInteractions() {
  const getGraphDelta = vi.fn((deltaX: number, deltaY: number): GraphPan => ({ x: deltaX, y: deltaY }));
  const onOpenFile = vi.fn();
  const pinnedPathRef: MutableRefObject<string | null> = { current: null };
  const pointsRef: MutableRefObject<GraphSimPoint[]> = { current: points };
  const geometryController = {
    changedPathsRef: { current: new Set<string>() },
    livePointsRef: pointsRef,
    notifyChanged: vi.fn(),
    subscribe: vi.fn()
  };
  let selectedPath: string | null = null;
  const setFocusedPath = vi.fn();
  const setPoints = vi.fn((nextPoints: GraphSimPoint[]) => {
    pointsRef.current = nextPoints;
  });
  const setSelectedPath = vi.fn((path: string | null) => {
    selectedPath = path;
  });
  const hook = renderHook(() => useGraphNodeInteractions({
    edges,
    forceSettings,
    getGraphDelta,
    geometryController,
    onOpenFile,
    pinnedPathRef,
    pointsRef,
    selectedPath,
    setFocusedPath,
    setPoints,
    setSelectedPath
  }));

  return {
    getGraphDelta,
    geometryController,
    hook,
    onOpenFile,
    pinnedPathRef,
    pointsRef,
    setFocusedPath,
    setPoints,
    setSelectedPath
  };
}

describe("useGraphNodeInteractions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("未選択nodeのclickとkey操作は選択だけを更新する", () => {
    const { hook, onOpenFile, setSelectedPath } = renderNodeInteractions();
    const point = points[0] as GraphPoint;

    act(() => {
      hook.result.current.onClick(point);
      hook.result.current.onKeyDown(makeEvent<SVGGElement>({ key: "Enter" }), point);
      hook.result.current.onKeyDown(makeEvent<SVGGElement>({ key: " " }), points[1]);
    });

    expect(setSelectedPath).toHaveBeenCalledWith("A.md");
    expect(setSelectedPath).toHaveBeenCalledWith("B.md");
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it("選択済みnodeをもう一度clickするとファイルを開く", () => {
    const { hook, onOpenFile, setSelectedPath } = renderNodeInteractions();
    const point = points[0] as GraphPoint;
    const target = {
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as SVGGElement;

    act(() => {
      hook.result.current.onPointerDown(makeEvent<SVGGElement>({ currentTarget: target, pointerId: 1 }), point);
      hook.result.current.onPointerUp(makeEvent<SVGGElement>({ currentTarget: target, pointerId: 1 }), point);
      hook.result.current.onClick(point);
    });
    expect(onOpenFile).not.toHaveBeenCalled();

    hook.rerender();
    act(() => {
      hook.result.current.onPointerDown(makeEvent<SVGGElement>({ currentTarget: target, pointerId: 2 }), point);
      hook.result.current.onPointerUp(makeEvent<SVGGElement>({ currentTarget: target, pointerId: 2 }), point);
      hook.result.current.onClick(point);
    });

    expect(setSelectedPath).toHaveBeenCalledWith("A.md");
    expect(onOpenFile).toHaveBeenCalledWith("A.md");
  });

  it("hover enter/leaveでfocused path更新を委譲する", () => {
    const { hook, setFocusedPath } = renderNodeInteractions();

    act(() => {
      hook.result.current.onPointerEnter("A.md");
      hook.result.current.onPointerLeave("A.md");
    });

    expect(setFocusedPath).toHaveBeenCalledWith("A.md");
    const updater = setFocusedPath.mock.calls[1][0] as (current: string | null) => string | null;
    expect(updater("A.md")).toBeNull();
    expect(updater("B.md")).toBe("B.md");
  });

  it("drag中のmoveで対象node座標をbounds内にclampする", () => {
    const { geometryController, hook, pinnedPathRef, pointsRef, setPoints, setSelectedPath } = renderNodeInteractions();
    const target = {
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as SVGGElement;

    act(() => {
      hook.result.current.onPointerDown(makeEvent<SVGGElement>({
        clientX: 10,
        clientY: 10,
        currentTarget: target,
        pointerId: 9
      }), points[0]);
    });

    expect(pinnedPathRef.current).toBe("A.md");
    expect(setSelectedPath).toHaveBeenCalledWith("A.md");

    act(() => {
      hook.result.current.onPointerMove(makeEvent<SVGGElement>({
        clientX: 5000,
        clientY: 5000,
        currentTarget: target,
        pointerId: 9
      }));
    });

    const movedPoint = pointsRef.current.find((point) => point.path === "A.md");
    expect(setPoints).not.toHaveBeenCalled();
    expect(geometryController.notifyChanged).toHaveBeenCalledWith(new Set(["A.md", "B.md"]));
    expect(movedPoint?.x).toBe(GRAPH_WIDTH - GRAPH_PADDING);
    expect(movedPoint?.y).toBe(GRAPH_HEIGHT - GRAPH_PADDING);
  });

  it("drag中は隣接nodeも局所simulationで反応する", () => {
    const { hook, pointsRef } = renderNodeInteractions();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const target = {
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as SVGGElement;

    act(() => {
      hook.result.current.onPointerDown(makeEvent<SVGGElement>({
        clientX: 10,
        clientY: 10,
        currentTarget: target,
        pointerId: 8
      }), points[0]);
      hook.result.current.onPointerMove(makeEvent<SVGGElement>({
        clientX: 80,
        clientY: 30,
        currentTarget: target,
        pointerId: 8
      }));
    });

    const neighbor = pointsRef.current.find((point) => point.path === "B.md");
    expect(neighbor?.x).not.toBe(160);
    expect(neighbor?.y).not.toBe(130);
  });

  it("局所relaxは2 hop外のnodeを動かさない", () => {
    const localPoints: GraphSimPoint[] = [
      ...points,
      { degree: 0, folder: "", incoming: 0, name: "C", outgoing: 0, path: "C.md", tags: [], vx: 0, vy: 0, x: 400, y: 400 },
      { degree: 0, folder: "", incoming: 0, name: "D", outgoing: 0, path: "D.md", tags: [], vx: 0, vy: 0, x: 520, y: 420 }
    ];
    const localEdges = [
      { sourcePath: "A.md", targetPath: "B.md" },
      { sourcePath: "C.md", targetPath: "D.md" }
    ];
    const neighborhoodPaths = collectGraphNeighborhoodPaths(localEdges, "A.md", 2);

    const relaxed = relaxGraphNeighborhood(
      localPoints,
      localEdges,
      forceSettings,
      neighborhoodPaths,
      "A.md",
      { x: 140, y: 140 },
      2
    );

    expect(neighborhoodPaths).toEqual(new Set(["A.md", "B.md"]));
    expect(relaxed.find((point) => point.path === "A.md")).toMatchObject({ x: 140, y: 140 });
    expect(relaxed.find((point) => point.path === "B.md")?.x).not.toBe(160);
    expect(relaxed.find((point) => point.path === "C.md")).toBe(localPoints[2]);
    expect(relaxed.find((point) => point.path === "D.md")).toBe(localPoints[3]);
  });

  it("drag後のclickを抑止しpinned pathを解除してsettleを始める", () => {
    const { geometryController, hook, onOpenFile, pinnedPathRef, setPoints, setSelectedPath } = renderNodeInteractions();
    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    const target = {
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as SVGGElement;

    act(() => {
      hook.result.current.onPointerDown(makeEvent<SVGGElement>({
        clientX: 10,
        clientY: 10,
        currentTarget: target,
        pointerId: 4
      }), points[0]);
      hook.result.current.onPointerMove(makeEvent<SVGGElement>({
        clientX: 30,
        clientY: 30,
        currentTarget: target,
        pointerId: 4
      }));
      hook.result.current.onPointerUp(makeEvent<SVGGElement>({
        currentTarget: target,
        pointerId: 4
      }), points[0]);
      hook.result.current.onClick(points[0]);
    });

    expect(pinnedPathRef.current).toBeNull();
    expect(setSelectedPath).toHaveBeenCalledTimes(1);
    expect(onOpenFile).not.toHaveBeenCalled();
    expect(frameCallbacks.length).toBeGreaterThan(0);
    expect(setPoints).toHaveBeenCalledTimes(1);
    act(() => {
      for (let index = 0; index < 8; index += 1) {
        const callback = frameCallbacks.shift();
        callback?.(16);
      }
    });
    expect(geometryController.notifyChanged).toHaveBeenCalledWith(new Set(["A.md", "B.md"]));
    expect(setPoints).toHaveBeenCalledTimes(2);
  });
});
