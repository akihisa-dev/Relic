import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GanttChartEntry, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import { useChronicleChartViewport } from "./useChronicleChartViewport";

function entry(overrides: Partial<GanttChartEntry> = {}): GanttChartEntry {
  return {
    endLabel: "11",
    endValue: 11,
    fileName: "A",
    path: "A.md",
    startLabel: "10",
    startValue: 10,
    ...overrides
  };
}

function chart(source: GanttChartSource = "chronicle"): WorkspaceGanttChart {
  return {
    entries: [entry()],
    id: source,
    name: source,
    source
  };
}

function makeDiv({ clientWidth, left = 0, scrollWidth, width = clientWidth }: {
  clientWidth: number;
  left?: number;
  scrollWidth: number;
  width?: number;
}): HTMLDivElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
  element.getBoundingClientRect = () => ({ left, width } as DOMRect);
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn().mockReturnValue(true);
  element.releasePointerCapture = vi.fn();
  return element;
}

function makePointerEvent<T extends Element>(overrides: Partial<{
  button: number;
  clientX: number;
  currentTarget: T;
  pointerId: number;
  preventDefault: () => void;
  target: Element;
}>): never {
  return {
    button: 0,
    clientX: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    target: overrides.currentTarget,
    ...overrides
  } as never;
}

function renderViewport(activeSource: GanttChartSource = "chronicle") {
  const hook = renderHook(() => useChronicleChartViewport({
    activeChart: chart(activeSource),
    activeSource,
    axisEnd: 99,
    axisStart: 0,
    entries: [entry({ endValue: 20, startValue: 10 })],
    nameColumnWidth: 50,
    unitWidth: 10
  }));
  return { hook };
}

describe("useChronicleChartViewport", () => {
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

  function flushAnimationFrames(timestamp = 1_000_000): void {
    const callbacks = frameCallbacks.splice(0);
    act(() => {
      callbacks.forEach((callback) => callback(timestamp));
    });
  }

  it("scrollToTimelineValueでtargetを中央寄せしscroll範囲内にclampする", () => {
    const { hook } = renderViewport();
    const chartElement = makeDiv({ clientWidth: 200, scrollWidth: 1000 });
    (hook.result.current.chartRef as MutableRefObject<HTMLDivElement | null>).current = chartElement;

    act(() => {
      hook.result.current.scrollToTimelineValue(10);
    });

    expect(chartElement.scrollLeft).toBe(30);
    expect(hook.result.current.scrollLeft).toBe(30);
  });

  it("smooth指定のtimeline移動はrequestAnimationFrameでscrollする", () => {
    const { hook } = renderViewport();
    const chartElement = makeDiv({ clientWidth: 200, scrollWidth: 1000 });
    (hook.result.current.chartRef as MutableRefObject<HTMLDivElement | null>).current = chartElement;

    act(() => {
      hook.result.current.scrollToTimelineValue(10, "smooth");
    });

    expect(chartElement.scrollLeft).toBe(0);

    flushAnimationFrames();

    expect(chartElement.scrollLeft).toBe(30);
    expect(hook.result.current.scrollLeft).toBe(30);
  });

  it("chart pointer dragで横panする", () => {
    const { hook } = renderViewport();
    const chartElement = makeDiv({ clientWidth: 200, scrollWidth: 1000 });
    chartElement.scrollLeft = 100;

    act(() => {
      hook.result.current.startChartPan(makePointerEvent<HTMLDivElement>({
        clientX: 10,
        currentTarget: chartElement,
        pointerId: 4,
        target: chartElement
      }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: -40 }));
    });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
    flushAnimationFrames();

    expect(chartElement.scrollLeft).toBe(150);
    expect(hook.result.current.scrollLeft).toBe(150);
  });

  it("barやfile名上のpointer downではpanを開始しない", () => {
    const { hook } = renderViewport();
    const chartElement = makeDiv({ clientWidth: 200, scrollWidth: 1000 });
    const excludedTarget = document.createElement("button");
    excludedTarget.className = "chronicle-fill";
    const preventDefault = vi.fn();

    act(() => {
      hook.result.current.startChartPan(makePointerEvent<HTMLDivElement>({
        currentTarget: chartElement,
        preventDefault,
        target: excludedTarget
      }));
    });

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("minimap pointer操作でtimeline値へscrollする", () => {
    const { hook } = renderViewport();
    const chartElement = makeDiv({ clientWidth: 200, scrollWidth: 1000 });
    const minimapElement = makeDiv({ clientWidth: 100, scrollWidth: 100, width: 100 });
    (hook.result.current.chartRef as MutableRefObject<HTMLDivElement | null>).current = chartElement;
    (hook.result.current.minimapRef as MutableRefObject<HTMLDivElement | null>).current = minimapElement;

    act(() => {
      hook.result.current.handleMinimapPointer(makePointerEvent<HTMLDivElement>({
        clientX: 50,
        currentTarget: minimapElement,
        target: minimapElement
      }));
    });
    flushAnimationFrames();

    expect(chartElement.scrollLeft).toBe(430);
    expect(hook.result.current.scrollLeft).toBe(430);
  });

  it("date sourceでもminimap pointer操作でtimeline値へscrollする", () => {
    const { hook } = renderViewport("date");
    const chartElement = makeDiv({ clientWidth: 200, scrollWidth: 1000 });
    const minimapElement = makeDiv({ clientWidth: 100, scrollWidth: 100, width: 100 });
    (hook.result.current.chartRef as MutableRefObject<HTMLDivElement | null>).current = chartElement;
    (hook.result.current.minimapRef as MutableRefObject<HTMLDivElement | null>).current = minimapElement;

    act(() => {
      hook.result.current.handleMinimapPointer(makePointerEvent<HTMLDivElement>({
        clientX: 50,
        currentTarget: minimapElement,
        target: minimapElement
      }));
    });
    flushAnimationFrames();

    expect(chartElement.scrollLeft).toBe(430);
    expect(hook.result.current.scrollLeft).toBe(430);
  });
});
