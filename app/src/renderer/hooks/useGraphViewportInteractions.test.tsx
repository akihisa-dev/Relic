import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GRAPH_HEIGHT, GRAPH_WIDTH } from "../graphLayout";
import { useGraphViewportInteractions } from "./useGraphViewportInteractions";

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
    target,
    ...overrides
  } as never;
}

function renderViewport(zoom = 1) {
  const onBackgroundClick = vi.fn();
  const setZoom = vi.fn();
  const hook = renderHook((props: { zoom: number }) => useGraphViewportInteractions({
    onBackgroundClick,
    setZoom,
    zoom: props.zoom
  }), {
    initialProps: { zoom }
  });

  return { hook, onBackgroundClick, setZoom };
}

describe("useGraphViewportInteractions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wheel操作を次の描画フレームでzoom更新callbackへ反映する", () => {
    const { hook, setZoom } = renderViewport();
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const surfaceTarget = {
      getBoundingClientRect: () => ({ height: GRAPH_HEIGHT, left: 0, top: 0, width: GRAPH_WIDTH } as DOMRect)
    } as unknown as HTMLDivElement;
    (hook.result.current.surfaceRef as { current: HTMLDivElement | null }).current = surfaceTarget;

    act(() => {
      hook.result.current.graphHandlers.onWheel(makeEvent<HTMLDivElement>({
        clientX: GRAPH_WIDTH * 0.75,
        clientY: GRAPH_HEIGHT * 0.5,
        deltaY: -100
      }));
    });

    expect(setZoom).not.toHaveBeenCalled();
    act(() => {
      frameCallback?.(16);
    });

    expect(setZoom).toHaveBeenCalledWith(1.1503);
    hook.rerender({ zoom: 1.1503 });
    expect(hook.result.current.viewBox.x + hook.result.current.viewBox.width * 0.75).toBeCloseTo(GRAPH_WIDTH * 0.75);
    expect(hook.result.current.viewBox.y + hook.result.current.viewBox.height * 0.5).toBeCloseTo(GRAPH_HEIGHT * 0.5);
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("wheel操作中はReact state確定前にlive viewportを通知する", () => {
    const { hook, setZoom } = renderViewport();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const listener = vi.fn();
    const surfaceTarget = {
      getBoundingClientRect: () => ({ height: GRAPH_HEIGHT, left: 0, top: 0, width: GRAPH_WIDTH } as DOMRect)
    } as unknown as HTMLDivElement;
    (hook.result.current.surfaceRef as { current: HTMLDivElement | null }).current = surfaceTarget;
    const unsubscribe = hook.result.current.viewportController.subscribe(listener);

    act(() => {
      hook.result.current.graphHandlers.onWheel(makeEvent<HTMLDivElement>({
        clientX: GRAPH_WIDTH * 0.5,
        clientY: GRAPH_HEIGHT * 0.5,
        deltaY: -100
      }));
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(setZoom).not.toHaveBeenCalled();
    expect(hook.result.current.viewportController.liveViewBoxRef.current.width).toBeLessThan(GRAPH_WIDTH);
    unsubscribe();
  });

  it("連続wheel操作を1フレームにまとめてzoom更新callbackを1回だけ呼ぶ", () => {
    const { hook, setZoom } = renderViewport();
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 1;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const surfaceTarget = {
      getBoundingClientRect: () => ({ height: GRAPH_HEIGHT, left: 0, top: 0, width: GRAPH_WIDTH } as DOMRect)
    } as unknown as HTMLDivElement;
    (hook.result.current.surfaceRef as { current: HTMLDivElement | null }).current = surfaceTarget;

    act(() => {
      hook.result.current.graphHandlers.onWheel(makeEvent<HTMLDivElement>({
        clientX: GRAPH_WIDTH * 0.5,
        clientY: GRAPH_HEIGHT * 0.5,
        deltaY: -50
      }));
      hook.result.current.graphHandlers.onWheel(makeEvent<HTMLDivElement>({
        clientX: GRAPH_WIDTH * 0.5,
        clientY: GRAPH_HEIGHT * 0.5,
        deltaY: -50
      }));
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(setZoom).not.toHaveBeenCalled();

    act(() => {
      frameCallback?.(16);
    });

    expect(setZoom).toHaveBeenCalledTimes(1);
    expect(setZoom).toHaveBeenCalledWith(1.1503);
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("key操作でzoomとpanを更新する", () => {
    const { hook, setZoom } = renderViewport();

    act(() => {
      hook.result.current.graphHandlers.onKeyDown(makeEvent<HTMLDivElement>({ key: "=" }));
    });
    act(() => {
      hook.result.current.graphHandlers.onKeyDown(makeEvent<HTMLDivElement>({ key: "ArrowRight" }));
    });

    expect(setZoom).toHaveBeenCalledWith(1.1);
    expect(hook.result.current.viewBox.x).toBe(28);
  });

  it("pointer dragのpan更新を次の描画フレームにまとめる", () => {
    const { hook, onBackgroundClick } = renderViewport();
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 10;
    });
    const surfaceTarget = {
      getBoundingClientRect: () => ({ height: GRAPH_HEIGHT, width: GRAPH_WIDTH } as DOMRect),
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as HTMLDivElement;
    (hook.result.current.surfaceRef as { current: HTMLDivElement | null }).current = surfaceTarget;

    act(() => {
      hook.result.current.graphHandlers.onPointerDown(makeEvent<HTMLDivElement>({
        clientX: 10,
        clientY: 20,
        currentTarget: surfaceTarget,
        pointerId: 4
      }));
    });

    expect(hook.result.current.isPanning).toBe(true);
    expect(hook.result.current.pauseSimulationRef.current).toBe(true);

    act(() => {
      hook.result.current.graphHandlers.onPointerMove(makeEvent<HTMLDivElement>({
        clientX: 110,
        clientY: 70,
        currentTarget: surfaceTarget,
        pointerId: 4
      }));
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.viewBox.x).toBe(0);
    expect(hook.result.current.viewBox.y).toBe(0);

    act(() => {
      frameCallback?.(16);
    });

    expect(hook.result.current.viewBox.x).toBe(-100);
    expect(hook.result.current.viewBox.y).toBe(-50);

    act(() => {
      hook.result.current.graphHandlers.onPointerUp(makeEvent<HTMLDivElement>({
        currentTarget: surfaceTarget,
        pointerId: 4
      }));
    });

    expect(hook.result.current.isPanning).toBe(false);
    expect(hook.result.current.pauseSimulationRef.current).toBe(false);
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it("連続pointer moveを1フレームにまとめて最後のpanだけを反映する", () => {
    const { hook } = renderViewport();
    let frameCallback: FrameRequestCallback | null = null;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallback = callback;
      return 11;
    });
    const surfaceTarget = {
      getBoundingClientRect: () => ({ height: GRAPH_HEIGHT, width: GRAPH_WIDTH } as DOMRect),
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as HTMLDivElement;
    (hook.result.current.surfaceRef as { current: HTMLDivElement | null }).current = surfaceTarget;

    act(() => {
      hook.result.current.graphHandlers.onPointerDown(makeEvent<HTMLDivElement>({
        clientX: 10,
        clientY: 20,
        currentTarget: surfaceTarget,
        pointerId: 6
      }));
      hook.result.current.graphHandlers.onPointerMove(makeEvent<HTMLDivElement>({
        clientX: 60,
        clientY: 40,
        currentTarget: surfaceTarget,
        pointerId: 6
      }));
      hook.result.current.graphHandlers.onPointerMove(makeEvent<HTMLDivElement>({
        clientX: 210,
        clientY: 120,
        currentTarget: surfaceTarget,
        pointerId: 6
      }));
    });

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(hook.result.current.viewBox.x).toBe(0);

    act(() => {
      frameCallback?.(16);
    });

    expect(hook.result.current.viewBox.x).toBe(-200);
    expect(hook.result.current.viewBox.y).toBe(-100);
  });

  it("pointer cancelではpending panを破棄して背景clickを呼ばない", () => {
    const { hook, onBackgroundClick } = renderViewport();
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 12);
    const surfaceTarget = {
      getBoundingClientRect: () => ({ height: GRAPH_HEIGHT, width: GRAPH_WIDTH } as DOMRect),
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as HTMLDivElement;
    (hook.result.current.surfaceRef as { current: HTMLDivElement | null }).current = surfaceTarget;

    act(() => {
      hook.result.current.graphHandlers.onPointerDown(makeEvent<HTMLDivElement>({
        clientX: 10,
        clientY: 20,
        currentTarget: surfaceTarget,
        pointerId: 7
      }));
      hook.result.current.graphHandlers.onPointerMove(makeEvent<HTMLDivElement>({
        clientX: 110,
        clientY: 70,
        currentTarget: surfaceTarget,
        pointerId: 7
      }));
      hook.result.current.graphHandlers.onPointerCancel(makeEvent<HTMLDivElement>({
        currentTarget: surfaceTarget,
        pointerId: 7
      }));
    });

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(12);
    expect(hook.result.current.viewBox.x).toBe(0);
    expect(hook.result.current.isPanning).toBe(false);
    expect(hook.result.current.pauseSimulationRef.current).toBe(false);
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });

  it("背景clickでは背景click callbackを呼ぶ", () => {
    const { hook, onBackgroundClick } = renderViewport();
    const surfaceTarget = {
      hasPointerCapture: vi.fn().mockReturnValue(true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn()
    } as unknown as HTMLDivElement;

    act(() => {
      hook.result.current.graphHandlers.onPointerDown(makeEvent<HTMLDivElement>({
        currentTarget: surfaceTarget,
        pointerId: 5
      }));
      hook.result.current.graphHandlers.onPointerUp(makeEvent<HTMLDivElement>({
        currentTarget: surfaceTarget,
        pointerId: 5
      }));
    });

    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });
});
