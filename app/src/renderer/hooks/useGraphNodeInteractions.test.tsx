import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { GRAPH_HEIGHT, GRAPH_PADDING, GRAPH_WIDTH } from "../graphLayout";
import type { GraphPan, GraphPoint, GraphSimPoint } from "../graphLayout";
import { useGraphNodeInteractions } from "./useGraphNodeInteractions";

const points: GraphSimPoint[] = [
  { degree: 1, folder: "", incoming: 0, name: "A", outgoing: 1, path: "A.md", tags: [], vx: 0, vy: 0, x: 80, y: 90 },
  { degree: 1, folder: "", incoming: 1, name: "B", outgoing: 0, path: "B.md", tags: [], vx: 0, vy: 0, x: 160, y: 130 }
];

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
  const pinnedPathRef: MutableRefObject<string | null> = { current: null };
  const pointsRef: MutableRefObject<GraphSimPoint[]> = { current: points };
  const setFocusedPath = vi.fn();
  const setPoints = vi.fn((nextPoints: GraphSimPoint[]) => {
    pointsRef.current = nextPoints;
  });
  const setSelectedPath = vi.fn();
  const hook = renderHook(() => useGraphNodeInteractions({
    getGraphDelta,
    pinnedPathRef,
    pointsRef,
    setFocusedPath,
    setPoints,
    setSelectedPath
  }));

  return {
    getGraphDelta,
    hook,
    pinnedPathRef,
    pointsRef,
    setFocusedPath,
    setPoints,
    setSelectedPath
  };
}

describe("useGraphNodeInteractions", () => {
  it("clickとkey操作は選択だけを更新する", () => {
    const { hook, setSelectedPath } = renderNodeInteractions();
    const point = points[0] as GraphPoint;

    act(() => {
      hook.result.current.onClick(point);
      hook.result.current.onKeyDown(makeEvent<SVGGElement>({ key: "Enter" }), point);
      hook.result.current.onKeyDown(makeEvent<SVGGElement>({ key: " " }), points[1]);
    });

    expect(setSelectedPath).toHaveBeenCalledWith("A.md");
    expect(setSelectedPath).toHaveBeenCalledWith("B.md");
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
    const { hook, pinnedPathRef, pointsRef, setPoints, setSelectedPath } = renderNodeInteractions();
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
    expect(setPoints).toHaveBeenCalledTimes(1);
    expect(movedPoint?.x).toBe(GRAPH_WIDTH - GRAPH_PADDING);
    expect(movedPoint?.y).toBe(GRAPH_HEIGHT - GRAPH_PADDING);
  });

  it("drag後のclickを抑止しpinned pathを解除する", () => {
    const { hook, pinnedPathRef, setSelectedPath } = renderNodeInteractions();
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
  });
});
