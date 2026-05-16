import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent, RefObject, SetStateAction, UIEvent } from "react";

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
  zoomIndex: number;
  setZoomIndex: Dispatch<SetStateAction<number>>;
}

export interface ChronicleChartViewport {
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportWidth: number;
  fitChronicleOverview: () => void;
  handleChartScroll: (event: UIEvent<HTMLDivElement>) => void;
  handleMinimapPointer: (event: PointerEvent<HTMLDivElement>) => void;
  minimapRef: RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  scrollToChronicleFocus: () => void;
  scrollToTimelineValue: (value: number) => void;
  scrollToToday: () => void;
  startChartPan: (event: PointerEvent<HTMLDivElement>) => void;
}

export function useChronicleChartViewport({
  activeChart,
  activeSource,
  axisEnd,
  axisStart,
  entries,
  nameColumnWidth,
  unitWidth,
  zoomIndex,
  setZoomIndex
}: UseChronicleChartViewportInput): ChronicleChartViewport {
  const [scrollLeft, setScrollLeft] = useState(0);
  const [chartViewportWidth, setChartViewportWidth] = useState(720);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const previousTimelineMetricsRef = useRef<{ axisStart: number; unitWidth: number } | null>(null);
  const focusAfterZoomRef = useRef(false);
  const initialDateScrollKeyRef = useRef<string | null>(null);
  const initialChronicleScrollKeyRef = useRef<string | null>(null);

  const updateChartViewportWidth = useCallback((): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const nextWidth = chartElement.clientWidth || chartElement.getBoundingClientRect().width || 720;
    setChartViewportWidth(nextWidth);
  }, []);

  const scrollToTimelineValue = useCallback((value: number): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const currentViewportTimelineWidth = Math.max(1, (chartElement.clientWidth || chartViewportWidth) - nameColumnWidth);
    const maxScrollLeft = Math.max(0, chartElement.scrollWidth - (chartElement.clientWidth || chartViewportWidth));
    const targetScrollLeft = clamp(
      (value - axisStart + 0.5) * unitWidth - currentViewportTimelineWidth / 2,
      0,
      maxScrollLeft
    );

    chartElement.scrollLeft = targetScrollLeft;
    setScrollLeft(targetScrollLeft);
  }, [axisStart, chartViewportWidth, nameColumnWidth, unitWidth]);

  const scrollToToday = useCallback((): void => {
    scrollToTimelineValue(dateNavigationTarget(entries, axisStart, axisEnd));
  }, [axisEnd, axisStart, entries, scrollToTimelineValue]);

  const scrollToChronicleFocus = useCallback((): void => {
    const target = chronicleNavigationTarget(entries, axisStart, axisEnd);
    if (target !== null) scrollToTimelineValue(target);
  }, [axisEnd, axisStart, entries, scrollToTimelineValue]);

  const fitChronicleOverview = useCallback((): void => {
    if (zoomIndex === 0) {
      scrollToChronicleFocus();
      return;
    }

    focusAfterZoomRef.current = true;
    setZoomIndex(0);
  }, [scrollToChronicleFocus, setZoomIndex, zoomIndex]);

  const handleChartScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    setScrollLeft(event.currentTarget.scrollLeft);
  }, []);

  const startChartPan = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;
    if (event.target instanceof Element && event.target.closest(".chronicle-fill, .chronicle-file-name, .chronicle-offscreen-jump")) return;

    const chartElement = event.currentTarget;
    const startClientX = event.clientX;
    const startScrollLeft = chartElement.scrollLeft;

    event.preventDefault();

    if (chartElement.setPointerCapture) {
      chartElement.setPointerCapture(event.pointerId);
    }

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const nextScrollLeft = Math.max(0, startScrollLeft - (moveEvent.clientX - startClientX));
      chartElement.scrollLeft = nextScrollLeft;
      setScrollLeft(nextScrollLeft);
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
  }, []);

  const handleMinimapPointer = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (activeSource !== "chronicle" || event.button > 0) return;

    const minimapElement = minimapRef.current;
    if (!minimapElement) return;

    const scrollFromClientX = (clientX: number): void => {
      const rect = minimapElement.getBoundingClientRect();
      const ratio = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      const targetValue = axisStart + ratio * Math.max(1, axisEnd - axisStart + 1);
      scrollToTimelineValue(targetValue);
    };

    event.preventDefault();
    scrollFromClientX(event.clientX);

    if (minimapElement.setPointerCapture) {
      minimapElement.setPointerCapture(event.pointerId);
    }

    const move = (moveEvent: globalThis.PointerEvent): void => scrollFromClientX(moveEvent.clientX);
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
  }, [activeSource, axisEnd, axisStart, scrollToTimelineValue]);

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
    const previousMetrics = previousTimelineMetricsRef.current;
    previousTimelineMetricsRef.current = { axisStart, unitWidth };

    if (!previousMetrics) return;
    if (previousMetrics.axisStart === axisStart && previousMetrics.unitWidth === unitWidth) return;

    const chartElement = chartRef.current;

    if (!chartElement) return;

    const currentViewportTimelineWidth = Math.max(1, (chartElement.clientWidth || chartViewportWidth) - nameColumnWidth);
    const centerValue = previousMetrics.axisStart + (chartElement.scrollLeft + currentViewportTimelineWidth / 2) / previousMetrics.unitWidth;
    const maxScrollLeft = Math.max(0, chartElement.scrollWidth - (chartElement.clientWidth || chartViewportWidth));
    const nextScrollLeft = clamp(
      (centerValue - axisStart) * unitWidth - currentViewportTimelineWidth / 2,
      0,
      maxScrollLeft
    );
    chartElement.scrollLeft = nextScrollLeft;
    setScrollLeft(nextScrollLeft);
  }, [axisStart, chartViewportWidth, nameColumnWidth, unitWidth]);

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

  useLayoutEffect(() => {
    if (activeSource !== "chronicle" || !activeChart || !focusAfterZoomRef.current || zoomIndex !== 0) return;

    focusAfterZoomRef.current = false;
    scrollToChronicleFocus();
  }, [activeChart, activeSource, scrollToChronicleFocus, zoomIndex]);

  return {
    chartRef,
    chartViewportWidth,
    fitChronicleOverview,
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
