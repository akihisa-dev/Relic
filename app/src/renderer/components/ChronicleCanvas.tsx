import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement, type WheelEvent } from "react";

import type { ChartEntry } from "../../shared/ipc";
import { cancelChronicleCanvasFrame, chronicleCanvasWheelFactor } from "../chronicleCanvasHelpers";
import {
  CHRONICLE_CANVAS_MAX_SCALE,
  CHRONICLE_CANVAS_MIN_SCALE,
  chronicleCanvasClickPath,
  chronicleCanvasPointerItemAtPoint,
  chronicleCanvasPointerMovedBeyondClickThreshold,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera,
  stepChronicleCanvasInertia,
  stepChronicleCanvasScene,
  zoomChronicleCanvasAtPoint,
  type ChronicleCanvasItem,
  type ChronicleCanvasPoint
} from "../chronicleCanvasModel";
import { drawChronicleCanvas, type ChronicleCanvasTheme } from "../chronicleCanvasRenderer";
import { useLatest } from "../hooks/useLatest";
import { useT } from "../i18n";

interface ChronicleCanvasProps {
  entries: ChartEntry[];
  onOpenFile: (path: string) => void;
}

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

export function ChronicleCanvas({ entries, onOpenFile }: ChronicleCanvasProps): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scene = useMemo(() => createChronicleCanvasScene(entries), [entries]);
  const sceneRef = useLatest(scene);
  const [camera] = useState(createChronicleCanvasCamera);
  const initializedSceneRef = useRef<unknown>(null);
  const pointerRef = useRef<PointerSession | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const hoveredPointRef = useRef<ChronicleCanvasPoint | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const simulationActiveRef = useRef(false);
  const lastPanDeltaRef = useRef({ x: 0, y: 0 });
  const openFileRef = useLatest(onOpenFile);
  const themeRef = useRef<ChronicleCanvasTheme>({
    background: "#f4f0e6",
    itemPalette: ["#f2691b", "#1a1b17", "#62625b", "#b8af9f", "#76756c", "#d95711"],
    mutedText: "#76756c",
    text: "#1a1b17"
  });

  const updateTheme = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const styles = getComputedStyle(canvas);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    themeRef.current = {
      background: token("--color-bg", "#f4f0e6"),
      itemPalette: [
        token("--color-accent", "#f2691b"),
        token("--color-primary", "#1a1b17"),
        token("--color-text-secondary", "#62625b"),
        token("--color-border-strong", "#b8af9f"),
        token("--color-text-muted", "#76756c"),
        token("--color-accent-strong", "#d95711")
      ],
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
    if (initializedSceneRef.current !== sceneRef.current) {
      initializedSceneRef.current = sceneRef.current;
      initializeChronicleCanvasCamera(camera, sceneRef.current, width, height);
    }

    const previous = previousFrameRef.current ?? timestamp;
    previousFrameRef.current = timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(1 / 240, (timestamp - previous) / 1000));
    const draggedItemId = pointerRef.current?.type === "item" ? pointerRef.current.item?.id ?? null : null;
    let simulationMoving = false;
    if (draggedItemId || simulationActiveRef.current) {
      simulationActiveRef.current = stepChronicleCanvasScene(sceneRef.current.items, draggedItemId, deltaSeconds);
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
      themeRef.current
    );
    if (simulationMoving || inertiaMoving || draggedItemId) {
      animationFrameRef.current = requestAnimationFrame(draw);
    }
  }, [updateTheme]);

  useEffect(() => {
    updateTheme();
    requestCanvasFrame(animationFrameRef, draw);
    const observer = new MutationObserver(() => {
      updateTheme();
      requestCanvasFrame(animationFrameRef, draw);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => requestCanvasFrame(animationFrameRef, draw));
    if (canvasRef.current) resizeObserver?.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      cancelChronicleCanvasFrame(animationFrameRef);
    };
  }, [draw, updateTheme]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = canvasPoint(event.clientX, event.clientY);
    const item = chronicleCanvasPointerItemAtPoint(sceneRef.current.items, camera, point);
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
  }, [canvasPoint, draw]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event.clientX, event.clientY);
    const hovered = chronicleCanvasPointerItemAtPoint(sceneRef.current.items, camera, point);
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
  }, [canvasPoint, draw]);

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
    const point = canvasPoint(event.clientX, event.clientY);
    const hovered = chronicleCanvasPointerItemAtPoint(sceneRef.current.items, camera, point);
    event.currentTarget.style.cursor = hovered ? "pointer" : "grab";
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) event.currentTarget.releasePointerCapture(pointer.pointerId);
    pointerRef.current = null;
    camera.velocityX = 0;
    camera.velocityY = 0;
    lastPanDeltaRef.current = { x: 0, y: 0 };
    simulationActiveRef.current = false;
    if (pointer.item) {
      pointer.item.vx = 0;
      pointer.item.vy = 0;
    }
    event.currentTarget.style.cursor = "grab";
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw]);

  const handleWheel = useCallback((event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = canvasPoint(event.clientX, event.clientY);
    const factor = chronicleCanvasWheelFactor(event.deltaY);
    const sceneMaximum = maximumScaleForScene(sceneRef.current, event.currentTarget.clientWidth || 720);
    const nextScale = Math.min(sceneMaximum, Math.max(CHRONICLE_CANVAS_MIN_SCALE, camera.scale * factor));
    zoomChronicleCanvasAtPoint(camera, nextScale, point);
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw]);

  return (
    <canvas
      aria-label={t("chronicle.timelineAria")}
      className="chronicle-canvas"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => {
        hoveredItemIdRef.current = null;
        hoveredPointRef.current = null;
        if (!pointerRef.current) canvasRef.current?.style.setProperty("cursor", "grab");
        requestCanvasFrame(animationFrameRef, draw);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      ref={canvasRef}
    />
  );
}

function requestCanvasFrame(
  frameRef: { current: number | null },
  draw: (timestamp: number) => void
): void {
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

function maximumScaleForScene(scene: ReturnType<typeof createChronicleCanvasScene>, viewportWidth: number): number {
  if (scene.years.length < 2) return CHRONICLE_CANVAS_MAX_SCALE;
  let widestNeighborSpan = 0;
  for (let index = 0; index < scene.years.length; index += 1) {
    const left = scene.years[Math.max(0, index - 1)].x;
    const right = scene.years[Math.min(scene.years.length - 1, index + 1)].x;
    widestNeighborSpan = Math.max(widestNeighborSpan, right - left);
  }
  return Math.max(0.4, Math.min(CHRONICLE_CANVAS_MAX_SCALE, viewportWidth / Math.max(240, widestNeighborSpan + 160)));
}
