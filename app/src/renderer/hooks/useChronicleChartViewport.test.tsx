import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GanttChartEntry, WorkspaceGanttChart } from "../../shared/ipc";
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

function chart(): WorkspaceGanttChart {
  return {
    entries: [entry()],
    id: "chronicle",
    name: "chronicle",
    source: "chronicle"
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

function renderViewport() {
  const setZoomIndex = vi.fn();
  const hook = renderHook(() => useChronicleChartViewport({
    activeChart: chart(),
    activeSource: "chronicle",
    axisEnd: 99,
    axisStart: 0,
    entries: [entry({ endValue: 20, startValue: 10 })],
    nameColumnWidth: 50,
    unitWidth: 10,
    zoomIndex: 5,
    setZoomIndex
  }));
  return { hook, setZoomIndex };
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

  it("全体表示は最小zoomへ切り替える", () => {
    const { hook, setZoomIndex } = renderViewport();

    act(() => {
      hook.result.current.fitChronicleOverview();
    });

    expect(setZoomIndex).toHaveBeenCalledWith(0);
  });
});
