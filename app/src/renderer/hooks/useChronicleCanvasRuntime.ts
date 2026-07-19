import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
  type WheelEvent
} from "react";

import type { ChartEntry } from "../../shared/ipc";
import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import { cancelChronicleCanvasFrame, chronicleCanvasWheelFactor } from "../chronicleCanvasHelpers";
import {
  CHRONICLE_CANVAS_MAX_SCALE,
  CHRONICLE_CANVAS_MIN_SCALE,
  changeChronicleCanvasPeriodScale,
  chronicleCanvasClickPath,
  chronicleCanvasPointerItemAtPoint,
  chronicleCanvasPointerMovedBeyondClickThreshold,
  chronicleCanvasYearHeaderHeight,
  createChronicleCanvasCamera,
  initializeChronicleCanvasCamera,
  prepareChronicleCanvasPointerCancel,
  stepChronicleCanvasInertia,
  stepChronicleCanvasScene,
  zoomChronicleCanvasAtPoint,
  type ChronicleCanvasItem,
  type ChronicleCanvasPoint,
  type ChronicleCanvasScene,
  type ChroniclePeriodScale
} from "../chronicleCanvasModel";
import { drawChronicleCanvas, type ChronicleCanvasTheme } from "../chronicleCanvasRenderer";
import { useLatest } from "./useLatest";

interface PointerSession {
  item: ChronicleCanvasItem | null;
  lastX: number;
  lastY: number;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  type: "item" | "pan";
}

interface UseChronicleCanvasRuntimeOptions {
  calendarSettings: ChronicleCalendarSettings;
  categoryHues: Map<string, number>;
  entries: ChartEntry[];
  hiddenCategoryKeys: Set<string>;
  onOpenFile: (path: string) => void;
  periodScale: ChroniclePeriodScale;
  scene: ChronicleCanvasScene;
  visibleItems: ChronicleCanvasItem[];
}

interface ChronicleCanvasRuntime {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  changePeriodScale: (nextPeriodScale: ChroniclePeriodScale) => void;
  handlePointerCancel: (event: PointerEvent<HTMLCanvasElement>) => void;
  handlePointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  handlePointerLeave: () => void;
  handlePointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
  handleWheel: (event: WheelEvent<HTMLCanvasElement>) => void;
}

export function useChronicleCanvasRuntime({
  calendarSettings,
  categoryHues,
  entries,
  hiddenCategoryKeys,
  onOpenFile,
  periodScale,
  scene,
  visibleItems
}: UseChronicleCanvasRuntimeOptions): ChronicleCanvasRuntime {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useLatest(scene);
  const entriesRef = useLatest(entries);
  const categoryHuesRef = useLatest(categoryHues);
  const hiddenCategoryKeysRef = useLatest(hiddenCategoryKeys);
  const visibleItemsRef = useLatest(visibleItems);
  const openFileRef = useLatest(onOpenFile);
  const [camera] = useState(createChronicleCanvasCamera);
  const initializedEntriesRef = useRef<ChartEntry[] | null>(null);
  const pointerRef = useRef<PointerSession | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const hoveredPointRef = useRef<ChronicleCanvasPoint | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const simulationActiveRef = useRef(false);
  const lastPanDeltaRef = useRef({ x: 0, y: 0 });
  const themeRef = useRef<ChronicleCanvasTheme>({
    background: "#f4f0e6",
    categoryLightness: 40,
    categorySaturation: 68,
    mutedText: "#76756c",
    text: "#1a1b17"
  });

  const updateTheme = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const styles = getComputedStyle(canvas);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const percentage = (name: string, fallback: number) => Number.parseFloat(token(name, String(fallback))) || fallback;
    themeRef.current = {
      background: token("--color-bg", "#f4f0e6"),
      categoryLightness: percentage("--chronicle-category-lightness", 40),
      categorySaturation: percentage("--chronicle-category-saturation", 68),
      mutedText: token("--color-text-secondary", "#62625b"),
      text: token("--color-text", "#1a1b17")
    };
  }, []);

  const draw = useCallback((timestamp: number) => {
    animationFrameRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvasContext(canvas);
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 720);
    const height = Math.max(1, rect.height || 420);
    const pixelRatio = window.devicePixelRatio || 1;
    const nextWidth = Math.floor(width * pixelRatio);
    const nextHeight = Math.floor(height * pixelRatio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      updateTheme();
    }
    if (initializedEntriesRef.current !== entriesRef.current) {
      initializedEntriesRef.current = entriesRef.current;
      initializeChronicleCanvasCamera(camera, sceneRef.current, width, height);
    }

    const previous = previousFrameRef.current ?? timestamp;
    previousFrameRef.current = timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(1 / 240, (timestamp - previous) / 1000));
    const draggedItemId = pointerRef.current?.type === "item" ? pointerRef.current.item?.id ?? null : null;
    let simulationMoving = false;
    if (draggedItemId || simulationActiveRef.current) {
      simulationActiveRef.current = stepChronicleCanvasScene(visibleItemsRef.current, draggedItemId, deltaSeconds);
      simulationMoving = simulationActiveRef.current;
    }
    const inertiaMoving = pointerRef.current?.type !== "pan" && stepChronicleCanvasInertia(camera);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawChronicleCanvas(
      context,
      sceneRef.current,
      camera,
      hoveredItemIdRef.current,
      hoveredPointRef.current,
      width,
      height,
      themeRef.current,
      hiddenCategoryKeysRef.current,
      categoryHuesRef.current,
      calendarSettings
    );
    if (simulationMoving || inertiaMoving || draggedItemId) {
      animationFrameRef.current = requestAnimationFrame(draw);
    }
  }, [calendarSettings, camera, categoryHuesRef, entriesRef, hiddenCategoryKeysRef, sceneRef, updateTheme, visibleItemsRef]);

  useEffect(() => {
    updateTheme();
    requestCanvasFrame(animationFrameRef, draw);
    const observer = new MutationObserver(() => {
      updateTheme();
      requestCanvasFrame(animationFrameRef, draw);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => requestCanvasFrame(animationFrameRef, draw));
    if (canvasRef.current) resizeObserver?.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      cancelChronicleCanvasFrame(animationFrameRef);
    };
  }, [draw, updateTheme]);

  useEffect(() => {
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw, scene]);

  useEffect(() => {
    const hoveredItemId = hoveredItemIdRef.current;
    if (hoveredItemId && !visibleItems.some((item) => item.id === hoveredItemId)) {
      hoveredItemIdRef.current = null;
      hoveredPointRef.current = null;
    }
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw, visibleItems]);

  const canvasPoint = useCallback((clientX: number, clientY: number): ChronicleCanvasPoint => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);
  const pointerItemAt = useCallback((point: ChronicleCanvasPoint): ChronicleCanvasItem | null => {
    if (point.y < chronicleCanvasYearHeaderHeight(camera.scale, calendarSettings.visibleCalendarNames.length)) return null;
    return chronicleCanvasPointerItemAtPoint(visibleItemsRef.current, camera, point);
  }, [calendarSettings.visibleCalendarNames.length, camera, visibleItemsRef]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const item = pointerItemAt(canvasPoint(event.clientX, event.clientY));
    event.currentTarget.setPointerCapture(event.pointerId);
    camera.velocityX = 0;
    camera.velocityY = 0;
    lastPanDeltaRef.current = { x: 0, y: 0 };
    pointerRef.current = {
      item,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      type: item ? "item" : "pan"
    };
    event.currentTarget.style.cursor = "grabbing";
    requestCanvasFrame(animationFrameRef, draw);
  }, [camera, canvasPoint, draw, pointerItemAt]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event.clientX, event.clientY);
    const hovered = pointerItemAt(point);
    const hoveredChanged = hoveredItemIdRef.current !== (hovered?.id ?? null);
    const hoveredPointChanged = hovered
      ? hoveredPointRef.current?.x !== point.x || hoveredPointRef.current?.y !== point.y
      : hoveredPointRef.current !== null;
    hoveredItemIdRef.current = hovered?.id ?? null;
    hoveredPointRef.current = hovered ? point : null;
    const pointer = pointerRef.current;
    event.currentTarget.style.cursor = pointer ? "grabbing" : hovered ? "pointer" : "grab";
    if (!pointer) {
      if (hoveredChanged || hoveredPointChanged) requestCanvasFrame(animationFrameRef, draw);
      return;
    }

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved ||= chronicleCanvasPointerMovedBeyondClickThreshold(
      { x: pointer.startX, y: pointer.startY },
      { x: event.clientX, y: event.clientY }
    );
    if (pointer.type === "pan") {
      camera.panX += dx;
      camera.panY += dy;
      lastPanDeltaRef.current = { x: dx, y: dy };
      requestCanvasFrame(animationFrameRef, draw);
      return;
    }
    if (pointer.item) {
      pointer.item.x += dx / camera.scale;
      pointer.item.y += dy / camera.scale;
      pointer.item.vx = dx / camera.scale;
      pointer.item.vy = dy / camera.scale;
      simulationActiveRef.current = true;
    }
    requestCanvasFrame(animationFrameRef, draw);
  }, [camera, canvasPoint, draw, pointerItemAt]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) event.currentTarget.releasePointerCapture(pointer.pointerId);
    if (pointer.type === "pan") {
      camera.velocityX = lastPanDeltaRef.current.x * 0.88;
      camera.velocityY = lastPanDeltaRef.current.y * 0.88;
    } else {
      const path = chronicleCanvasClickPath(pointer.item, pointer.moved);
      if (path) openFileRef.current(path);
      else simulationActiveRef.current = true;
    }
    pointerRef.current = null;
    const hovered = pointerItemAt(canvasPoint(event.clientX, event.clientY));
    event.currentTarget.style.cursor = hovered ? "pointer" : "grab";
    requestCanvasFrame(animationFrameRef, draw);
  }, [camera, canvasPoint, draw, openFileRef, pointerItemAt]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) event.currentTarget.releasePointerCapture(pointer.pointerId);
    pointerRef.current = null;
    lastPanDeltaRef.current = { x: 0, y: 0 };
    simulationActiveRef.current = prepareChronicleCanvasPointerCancel(camera, pointer.item, pointer.moved);
    event.currentTarget.style.cursor = "grab";
    requestCanvasFrame(animationFrameRef, draw);
  }, [camera, draw]);

  const handleWheel = useCallback((event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = canvasPoint(event.clientX, event.clientY);
    const factor = chronicleCanvasWheelFactor(event.deltaY);
    const nextScale = Math.min(CHRONICLE_CANVAS_MAX_SCALE, Math.max(CHRONICLE_CANVAS_MIN_SCALE, camera.scale * factor));
    zoomChronicleCanvasAtPoint(camera, nextScale, point);
    requestCanvasFrame(animationFrameRef, draw);
  }, [camera, canvasPoint, draw]);

  const handlePointerLeave = useCallback(() => {
    hoveredItemIdRef.current = null;
    hoveredPointRef.current = null;
    if (!pointerRef.current) canvasRef.current?.style.setProperty("cursor", "grab");
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw]);

  const changePeriodScale = useCallback((nextPeriodScale: ChroniclePeriodScale) => {
    if (nextPeriodScale === periodScale) return;
    const viewportWidth = canvasRef.current?.getBoundingClientRect().width || 720;
    changeChronicleCanvasPeriodScale(camera, periodScale, nextPeriodScale, viewportWidth);
  }, [camera, periodScale]);

  return {
    canvasRef,
    changePeriodScale,
    handlePointerCancel,
    handlePointerDown,
    handlePointerLeave,
    handlePointerMove,
    handlePointerUp,
    handleWheel
  };
}

function requestCanvasFrame(frameRef: { current: number | null }, draw: (timestamp: number) => void): void {
  if (frameRef.current !== null) return;
  frameRef.current = requestAnimationFrame(draw);
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) return null;
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}
