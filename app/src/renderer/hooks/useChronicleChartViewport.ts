import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject, UIEvent } from "react";

import type { GanttChartEntry, GanttChartSource, WorkspaceGanttChart } from "../../shared/ipc";
import {
  chronicleNavigationTarget,
  clamp,
  dateNavigationTarget
} from "../chronicleTimeline";

interface UseChronicleChartViewportInput {
  activeChart: WorkspaceGanttChart | null;
  activeSource: GanttChartSource;
  axisEnd: number;
  axisStart: number;
  entries: GanttChartEntry[];
  nameColumnWidth: number;
  unitWidth: number;
}

type ChartScrollBehavior = "auto" | "smooth";

const smoothScrollDurationMs = 260;

export interface ChronicleChartViewport {
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportWidth: number;
  handleChartScroll: (event: UIEvent<HTMLDivElement>) => void;
  handleMinimapPointer: (event: PointerEvent<HTMLDivElement>) => void;
  minimapRef: RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  scrollToChronicleFocus: () => void;
  scrollToTimelineValue: (value: number, behavior?: ChartScrollBehavior) => void;
  scrollToToday: () => void;
  startChartPan: (event: PointerEvent<HTMLDivElement>) => void;
}

function cancelFrame(frameId: number | null): void {
  if (frameId !== null && typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameId);
  }
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function requestFrame(callback: FrameRequestCallback): number | null {
  if (typeof window.requestAnimationFrame !== "function") return null;
  return window.requestAnimationFrame(callback);
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function maxScrollLeftFor(chartElement: HTMLDivElement, fallbackViewportWidth: number): number {
  const viewportWidth = chartElement.clientWidth || fallbackViewportWidth;
  if (chartElement.scrollWidth > viewportWidth) return chartElement.scrollWidth - viewportWidth;
  return Number.POSITIVE_INFINITY;
}

export function useChronicleChartViewport({
  activeChart,
  activeSource,
  axisEnd,
  axisStart,
  entries,
  nameColumnWidth,
  unitWidth
}: UseChronicleChartViewportInput): ChronicleChartViewport {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [chartViewportWidth, setChartViewportWidth] = useState(720);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const previousAxisStartRef = useRef<number | null>(null);
  const initialDateScrollKeyRef = useRef<string | null>(null);
  const initialChronicleScrollKeyRef = useRef<string | null>(null);
  const pendingScrollLeftRef = useRef<number | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollLeftRef = useRef(0);
  const scrollStateFrameRef = useRef<number | null>(null);

  const updateChartViewportWidth = useCallback((): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const nextWidth = chartElement.clientWidth || chartElement.getBoundingClientRect().width || 720;
    setChartViewportWidth(nextWidth);
  }, []);

  const stopSmoothScroll = useCallback((): void => {
    cancelFrame(scrollAnimationFrameRef.current);
    scrollAnimationFrameRef.current = null;
  }, []);

  const syncScrollLeft = useCallback((nextScrollLeft: number, behavior: ChartScrollBehavior = "auto"): void => {
    scrollLeftRef.current = nextScrollLeft;

    if (behavior === "auto") {
      cancelFrame(scrollStateFrameRef.current);
      scrollStateFrameRef.current = null;
      pendingScrollLeftRef.current = null;
      setScrollLeft((current) => current === nextScrollLeft ? current : nextScrollLeft);
      return;
    }

    pendingScrollLeftRef.current = nextScrollLeft;

    if (scrollStateFrameRef.current !== null) return;

    const frameId = requestFrame(() => {
      scrollStateFrameRef.current = null;
      const pendingScrollLeft = pendingScrollLeftRef.current ?? scrollLeftRef.current;
      pendingScrollLeftRef.current = null;
      setScrollLeft((current) => current === pendingScrollLeft ? current : pendingScrollLeft);
    });

    if (frameId === null) {
      const pendingScrollLeft = pendingScrollLeftRef.current ?? scrollLeftRef.current;
      pendingScrollLeftRef.current = null;
      setScrollLeft((current) => current === pendingScrollLeft ? current : pendingScrollLeft);
      return;
    }

    scrollStateFrameRef.current = frameId;
  }, []);

  const setChartScrollLeft = useCallback((
    chartElement: HTMLDivElement,
    nextScrollLeft: number,
    behavior: ChartScrollBehavior = "auto"
  ): void => {
    chartElement.scrollLeft = nextScrollLeft;
    syncScrollLeft(chartElement.scrollLeft, behavior);
  }, [syncScrollLeft]);

  const scrollChartTo = useCallback((
    chartElement: HTMLDivElement,
    targetScrollLeft: number,
    behavior: ChartScrollBehavior
  ): void => {
    const maxScrollLeft = maxScrollLeftFor(chartElement, chartViewportWidth);
    const clampedTarget = clamp(targetScrollLeft, 0, maxScrollLeft);

    stopSmoothScroll();

    if (
      behavior === "auto" ||
      prefersReducedMotion() ||
      Math.abs(chartElement.scrollLeft - clampedTarget) < 1
    ) {
      setChartScrollLeft(chartElement, clampedTarget, "auto");
      return;
    }

    const startScrollLeft = chartElement.scrollLeft;
    const distance = clampedTarget - startScrollLeft;
    const startTime = now();

    const step = (timestamp: number): void => {
      const progress = clamp((timestamp - startTime) / smoothScrollDurationMs, 0, 1);
      const nextScrollLeft = startScrollLeft + distance * easeOutCubic(progress);

      setChartScrollLeft(chartElement, progress >= 1 ? clampedTarget : nextScrollLeft, progress >= 1 ? "auto" : "smooth");

      if (progress >= 1) {
        scrollAnimationFrameRef.current = null;
        return;
      }

      scrollAnimationFrameRef.current = requestFrame(step);
      if (scrollAnimationFrameRef.current === null) {
        setChartScrollLeft(chartElement, clampedTarget, "auto");
      }
    };

    scrollAnimationFrameRef.current = requestFrame(step);
    if (scrollAnimationFrameRef.current === null) {
      setChartScrollLeft(chartElement, clampedTarget, "auto");
    }
  }, [chartViewportWidth, setChartScrollLeft, stopSmoothScroll]);

  const scrollToTimelineValue = useCallback((value: number, behavior: ChartScrollBehavior = "auto"): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const currentViewportTimelineWidth = Math.max(1, (chartElement.clientWidth || chartViewportWidth) - nameColumnWidth);
    const targetScrollLeft = (value - axisStart + 0.5) * unitWidth - currentViewportTimelineWidth / 2;

    scrollChartTo(chartElement, targetScrollLeft, behavior);
  }, [axisStart, chartViewportWidth, nameColumnWidth, scrollChartTo, unitWidth]);

  const scrollToToday = useCallback((): void => {
    scrollToTimelineValue(dateNavigationTarget(entries, axisStart, axisEnd), "smooth");
  }, [axisEnd, axisStart, entries, scrollToTimelineValue]);

  const scrollToChronicleFocus = useCallback((): void => {
    const target = chronicleNavigationTarget(entries, axisStart, axisEnd);
    if (target !== null) scrollToTimelineValue(target, "smooth");
  }, [axisEnd, axisStart, entries, scrollToTimelineValue]);

  const handleChartScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    syncScrollLeft(event.currentTarget.scrollLeft, "smooth");
  }, [syncScrollLeft]);

  const startChartPan = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;
    if (event.target instanceof Element && event.target.closest(".chronicle-fill, .chronicle-file-name, .chronicle-offscreen-jump")) return;

    const chartElement = event.currentTarget;
    const startClientX = event.clientX;
    const startScrollLeft = chartElement.scrollLeft;

    event.preventDefault();
    stopSmoothScroll();

    if (chartElement.setPointerCapture) {
      chartElement.setPointerCapture(event.pointerId);
    }

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const maxScrollLeft = maxScrollLeftFor(chartElement, chartViewportWidth);
      const nextScrollLeft = clamp(startScrollLeft - (moveEvent.clientX - startClientX), 0, maxScrollLeft);
      setChartScrollLeft(chartElement, nextScrollLeft, "smooth");
    };

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);

      if (chartElement.hasPointerCapture?.(event.pointerId)) {
        chartElement.releasePointerCapture(event.pointerId);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }, [chartViewportWidth, setChartScrollLeft, stopSmoothScroll]);

  const handleMinimapPointer = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;

    const minimapElement = minimapRef.current;
    if (!minimapElement) return;

    const scrollFromClientX = (clientX: number, behavior: ChartScrollBehavior): void => {
      const rect = minimapElement.getBoundingClientRect();
      const ratio = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      const targetValue = axisStart + ratio * Math.max(1, axisEnd - axisStart + 1);
      scrollToTimelineValue(targetValue, behavior);
    };

    event.preventDefault();
    scrollFromClientX(event.clientX, "smooth");

    if (minimapElement.setPointerCapture) {
      minimapElement.setPointerCapture(event.pointerId);
    }

    const move = (moveEvent: globalThis.PointerEvent): void => scrollFromClientX(moveEvent.clientX, "auto");
    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);

      if (minimapElement.hasPointerCapture?.(event.pointerId)) {
        minimapElement.releasePointerCapture(event.pointerId);
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }, [axisEnd, axisStart, scrollToTimelineValue]);

  useEffect(() => () => {
    stopSmoothScroll();
    cancelFrame(scrollStateFrameRef.current);
  }, [stopSmoothScroll]);

  useLayoutEffect(() => {
    updateChartViewportWidth();

    const chartElement = chartRef.current;
    if (!chartElement) return;

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateChartViewportWidth);
      observer.observe(chartElement);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateChartViewportWidth);
    return () => window.removeEventListener("resize", updateChartViewportWidth);
  }, [activeChart?.id, updateChartViewportWidth]);

  useLayoutEffect(() => {
    const previousAxisStart = previousAxisStartRef.current;
    previousAxisStartRef.current = axisStart;

    if (previousAxisStart === null || previousAxisStart === axisStart) return;

    const chartElement = chartRef.current;

    if (!chartElement) return;

    const delta = (previousAxisStart - axisStart) * unitWidth;

    if (delta === 0) return;

    const maxScrollLeft = maxScrollLeftFor(chartElement, chartViewportWidth);
    const nextScrollLeft = clamp(chartElement.scrollLeft + delta, 0, maxScrollLeft);
    scrollChartTo(chartElement, nextScrollLeft, "auto");
  }, [axisStart, chartViewportWidth, scrollChartTo, unitWidth]);

  useLayoutEffect(() => {
    if (activeSource !== "date" || !activeChart) return;

    const key = activeChart.id;
    if (initialDateScrollKeyRef.current === key) return;

    initialDateScrollKeyRef.current = key;
    scrollToToday();
  }, [activeChart, activeSource, scrollToToday]);

  useLayoutEffect(() => {
    if (activeSource !== "chronicle" || !activeChart) return;

    const key = activeChart.id;
    if (initialChronicleScrollKeyRef.current === key) return;

    initialChronicleScrollKeyRef.current = key;
    scrollToChronicleFocus();
  }, [activeChart, activeSource, scrollToChronicleFocus]);

  return {
    chartRef,
    chartViewportWidth,
    handleChartScroll,
    handleMinimapPointer,
    minimapRef,
    scrollLeft,
    scrollToChronicleFocus,
    scrollToTimelineValue,
    scrollToToday,
    startChartPan
  };
}
