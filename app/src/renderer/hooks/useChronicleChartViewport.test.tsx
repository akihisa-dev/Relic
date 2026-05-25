import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ChartEntry, ChartSource, WorkspaceChart } from "../../shared/ipc";
import { useChronicleChartViewport } from "./useChronicleChartViewport";

function entry(overrides: Partial<ChartEntry> = {}): ChartEntry {
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

function chart(source: ChartSource = "chronicle"): WorkspaceChart {
  return {
    entries: [entry()],
    id: source,
    name: source,
    source
  };
}

function makeDiv({ clientHeight = 200, clientWidth, height = clientHeight, left = 0, scrollHeight = clientHeight, scrollWidth, top = 0, width = clientWidth }: {
  clientHeight?: number;
  clientWidth: number;
  height?: number;
  left?: number;
  scrollHeight?: number;
  scrollWidth: number;
  top?: number;
  width?: number;
}): HTMLDivElement {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(element, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(element, "scrollWidth", { configurable: true, value: scrollWidth });
  element.getBoundingClientRect = () => ({ height, left, top, width } as DOMRect);
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn().mockReturnValue(true);
  element.releasePointerCapture = vi.fn();
  return element;
}

function makePointerEvent<T extends Element>(overrides: Partial<{
  button: number;
  clientX: number;
  clientY: number;
  currentTarget: T;
  pointerId: number;
  preventDefault: () => void;
  target: Element;
}>): never {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    preventDefault: vi.fn(),
    target: overrides.currentTarget,
    ...overrides
  } as never;
}

function renderViewport(activeSource: ChartSource = "chronicle") {
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

    expect(chartElement.scrollLeft).toBe(430);
    expect(hook.result.current.scrollLeft).toBe(430);
  });

  it("縦minimap pointer操作で行方向へscrollする", () => {
    const { hook } = renderViewport();
    const chartElement = makeDiv({ clientHeight: 200, clientWidth: 200, scrollHeight: 1000, scrollWidth: 1000 });
    const minimapElement = makeDiv({ clientHeight: 100, clientWidth: 12, height: 100, scrollWidth: 12 });
    (hook.result.current.chartRef as MutableRefObject<HTMLDivElement | null>).current = chartElement;
    (hook.result.current.verticalMinimapRef as MutableRefObject<HTMLDivElement | null>).current = minimapElement;

    act(() => {
      hook.result.current.handleVerticalMinimapPointer(makePointerEvent<HTMLDivElement>({
        clientY: 50,
        currentTarget: minimapElement,
        target: minimapElement
      }));
    });

    expect(chartElement.scrollTop).toBe(400);
    expect(hook.result.current.scrollTop).toBe(400);
  });
});
