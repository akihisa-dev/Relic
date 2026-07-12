import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement, type WheelEvent } from "react";

import type { ChartEntry } from "../../shared/ipc";
import { cancelChronicleCanvasFrame, chronicleCanvasWheelFactor } from "../chronicleCanvasHelpers";
import {
  CHRONICLE_CANVAS_MAX_SCALE,
  CHRONICLE_CANVAS_MIN_SCALE,
  chronicleCanvasItemAtPoint,
  chronicleCanvasLabelAtPoint,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera,
  stepChronicleCanvasInertia,
  stepChronicleCanvasScene,
  zoomChronicleCanvasAtPoint,
  type ChronicleCanvasItem,
  type ChronicleCanvasLabelHit
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
  const labelHitsRef = useRef<ChronicleCanvasLabelHit[]>([]);
  const previousFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const simulationActiveRef = useRef(false);
  const lastPanDeltaRef = useRef({ x: 0, y: 0 });
  const openFileRef = useLatest(onOpenFile);
  const themeRef = useRef<ChronicleCanvasTheme>({ background: "#ffffff", mutedText: "#6f7177", text: "#202124" });

  const updateTheme = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const styles = getComputedStyle(canvas);
    themeRef.current = {
      background: styles.getPropertyValue("--bg").trim() || "#ffffff",
      mutedText: styles.getPropertyValue("--text-2").trim() || "#6f7177",
      text: styles.getPropertyValue("--text").trim() || "#202124"
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
    const result = drawChronicleCanvas(
      context,
      sceneRef.current,
      camera,
      hoveredItemIdRef.current,
      width,
      height,
      themeRef.current
    );
    labelHitsRef.current = result.labelHits;
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
    const item = chronicleCanvasItemAtPoint(sceneRef.current.items, camera, point);
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
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event.clientX, event.clientY);
    const hovered = chronicleCanvasItemAtPoint(sceneRef.current.items, camera, point);
    const hoveredChanged = hoveredItemIdRef.current !== (hovered?.id ?? null);
    hoveredItemIdRef.current = hovered?.id ?? null;
    const clickableLabel = chronicleCanvasLabelAtPoint(labelHitsRef.current, point);
    event.currentTarget.style.cursor = clickableLabel ? "pointer" : "grab";
    const pointer = pointerRef.current;
    if (!pointer) {
      if (hoveredChanged) requestCanvasFrame(animationFrameRef, draw);
      return;
    }

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved ||= Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 4;
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
    } else if (!pointer.moved) {
      const point = canvasPoint(event.clientX, event.clientY);
      const label = chronicleCanvasLabelAtPoint(labelHitsRef.current, point);
      if (label) {
        const item = sceneRef.current.items.find((candidate) => candidate.id === label.itemId);
        if (item) openFileRef.current(item.entry.path);
      }
    } else {
      simulationActiveRef.current = true;
    }
    pointerRef.current = null;
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw]);

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
      onPointerCancel={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerLeave={() => {
        hoveredItemIdRef.current = null;
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
