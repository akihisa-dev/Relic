import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject, UIEvent } from "react";

import type { ChartEntry, ChartSource, WorkspaceChart } from "../../shared/ipc";
import {
  ROW_HEIGHT,
  chronicleNavigationTarget,
  clamp,
  dateNavigationTarget
} from "../chronicleTimeline";
import { startWindowPointerDrag } from "./windowPointerDrag";

interface UseChronicleChartViewportInput {
  activeChart: WorkspaceChart | null;
  activeSource: ChartSource;
  axisEnd: number;
  axisStart: number;
  entries: ChartEntry[];
  nameColumnWidth: number;
  unitWidth: number;
}

export interface ChronicleChartViewport {
  chartRef: RefObject<HTMLDivElement | null>;
  chartViewportHeight: number;
  chartViewportWidth: number;
  handleChartScroll: (event: UIEvent<HTMLDivElement>) => void;
  handleMinimapPointer: (event: PointerEvent<HTMLDivElement>) => void;
  handleVerticalMinimapPointer: (event: PointerEvent<HTMLDivElement>) => void;
  minimapRef: RefObject<HTMLDivElement | null>;
  scrollLeft: number;
  scrollToRowIndex: (rowIndex: number) => void;
  scrollToChronicleFocus: () => void;
  scrollToTimelineValue: (value: number) => void;
  scrollToToday: () => void;
  scrollTop: number;
  startChartPan: (event: PointerEvent<HTMLDivElement>) => void;
  verticalMinimapRef: RefObject<HTMLDivElement | null>;
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
  const [scrollTop, setScrollTop] = useState(0);
  const [chartViewportHeight, setChartViewportHeight] = useState(420);
  const [chartViewportWidth, setChartViewportWidth] = useState(720);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const verticalMinimapRef = useRef<HTMLDivElement | null>(null);
  const previousAxisStartRef = useRef<number | null>(null);
  const initialDateScrollKeyRef = useRef<string | null>(null);
  const initialChronicleScrollKeyRef = useRef<string | null>(null);

  const updateChartViewportSize = useCallback((): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const nextWidth = chartElement.clientWidth || chartElement.getBoundingClientRect().width || 720;
    const nextHeight = chartElement.clientHeight || chartElement.getBoundingClientRect().height || 420;
    setChartViewportWidth(nextWidth);
    setChartViewportHeight(nextHeight);
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

  const handleChartScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    setScrollLeft(event.currentTarget.scrollLeft);
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const startChartPan = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;
    if (event.target instanceof Element && event.target.closest(".chronicle-fill, .chronicle-file-name, .chronicle-offscreen-jump, .chronicle-vertical-offscreen-jump, .chronicle-vertical-minimap")) return;

    const chartElement = event.currentTarget;
    const startClientX = event.clientX;
    const startScrollLeft = chartElement.scrollLeft;

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const nextScrollLeft = Math.max(0, startScrollLeft - (moveEvent.clientX - startClientX));
      chartElement.scrollLeft = nextScrollLeft;
      setScrollLeft(nextScrollLeft);
    };

    startWindowPointerDrag({ event, onMove: move });
  }, []);

  const handleMinimapPointer = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;

    const minimapElement = minimapRef.current;
    if (!minimapElement) return;

    const scrollFromClientX = (clientX: number): void => {
      const rect = minimapElement.getBoundingClientRect();
      const ratio = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      const targetValue = axisStart + ratio * Math.max(1, axisEnd - axisStart + 1);
      scrollToTimelineValue(targetValue);
    };

    scrollFromClientX(event.clientX);

    const move = (moveEvent: globalThis.PointerEvent): void => scrollFromClientX(moveEvent.clientX);
    startWindowPointerDrag({ event, onMove: move, pointerCaptureTarget: minimapElement });
  }, [axisEnd, axisStart, scrollToTimelineValue]);

  const scrollToRowIndex = useCallback((rowIndex: number): void => {
    const chartElement = chartRef.current;
    if (!chartElement) return;

    const maxScrollTop = Math.max(0, chartElement.scrollHeight - (chartElement.clientHeight || chartViewportHeight));
    const targetScrollTop = clamp(rowIndex * ROW_HEIGHT, 0, maxScrollTop);

    chartElement.scrollTop = targetScrollTop;
    setScrollTop(targetScrollTop);
  }, [chartViewportHeight]);

  const handleVerticalMinimapPointer = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    if (event.button > 0) return;

    const minimapElement = verticalMinimapRef.current;
    if (!minimapElement) return;

    const scrollFromClientY = (clientY: number): void => {
      const chartElement = chartRef.current;
      if (!chartElement) return;

      const rect = minimapElement.getBoundingClientRect();
      const ratio = rect.height > 0 ? clamp((clientY - rect.top) / rect.height, 0, 1) : 0;
      const maxScrollTop = Math.max(0, chartElement.scrollHeight - (chartElement.clientHeight || chartViewportHeight));
      const nextScrollTop = ratio * maxScrollTop;

      chartElement.scrollTop = nextScrollTop;
      setScrollTop(nextScrollTop);
    };

    scrollFromClientY(event.clientY);

    const move = (moveEvent: globalThis.PointerEvent): void => scrollFromClientY(moveEvent.clientY);
    startWindowPointerDrag({ event, onMove: move, pointerCaptureTarget: minimapElement });
  }, [chartViewportHeight]);

  useLayoutEffect(() => {
    updateChartViewportSize();

    const chartElement = chartRef.current;
    if (!chartElement) return;

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateChartViewportSize);
      observer.observe(chartElement);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateChartViewportSize);
    return () => window.removeEventListener("resize", updateChartViewportSize);
  }, [activeChart?.id, updateChartViewportSize]);

  useLayoutEffect(() => {
    const previousAxisStart = previousAxisStartRef.current;
    previousAxisStartRef.current = axisStart;

    if (previousAxisStart === null || previousAxisStart === axisStart) return;

    const chartElement = chartRef.current;

    if (!chartElement) return;

    const delta = (previousAxisStart - axisStart) * unitWidth;

    if (delta === 0) return;

    const nextScrollLeft = Math.max(0, chartElement.scrollLeft + delta);
    chartElement.scrollLeft = nextScrollLeft;
    setScrollLeft(nextScrollLeft);
  }, [axisStart, unitWidth]);

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
    chartViewportHeight,
    chartViewportWidth,
    handleChartScroll,
    handleMinimapPointer,
    handleVerticalMinimapPointer,
    minimapRef,
    scrollLeft,
    scrollToRowIndex,
    scrollToChronicleFocus,
    scrollToTimelineValue,
    scrollToToday,
    scrollTop,
    startChartPan,
    verticalMinimapRef
  };
}
