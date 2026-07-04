import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactElement } from "react";

import type { ChartEntry } from "../../shared/ipc";
import {
  buildChronicleBubbleLayout,
  hitTestChronicleBubble,
  type ChronicleBubbleShape
} from "../chronicleBubbleLayout";
import { useT } from "../i18n";

interface ChronicleBubbleCanvasProps {
  entries: ChartEntry[];
  onOpenFile: (path: string) => void;
}

export function ChronicleBubbleCanvas({
  entries,
  onOpenFile
}: ChronicleBubbleCanvasProps): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layout = useMemo(() => buildChronicleBubbleLayout(entries), [entries]);
  const [hoveredShape, setHoveredShape] = useState<ChronicleBubbleShape | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (navigator.userAgent.toLowerCase().includes("jsdom")) return;

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas?.getContext("2d") ?? null;
    } catch {
      context = null;
    }
    if (!canvas || !context) return;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(layout.width * pixelRatio);
    canvas.height = Math.ceil(layout.height * pixelRatio);
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawChronicleBubbles(context, layout.shapes, hoveredShape);
  }, [hoveredShape, layout]);

  const shapeForEvent = (event: MouseEvent<HTMLCanvasElement>): ChronicleBubbleShape | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    return hitTestChronicleBubble(layout.shapes, event.clientX - rect.left, event.clientY - rect.top);
  };

  if (entries.length === 0) {
    return <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>;
  }

  return (
    <div className="chronicle-bubble-view">
      <div className="chronicle-bubble-scroll">
        <canvas
          aria-label={t("chronicle.bubbleCanvasLabel")}
          className="chronicle-bubble-canvas"
          onClick={(event) => {
            const shape = shapeForEvent(event);
            if (shape) onOpenFile(shape.entry.path);
          }}
          onMouseLeave={() => setHoveredShape(null)}
          onMouseMove={(event) => setHoveredShape(shapeForEvent(event))}
          ref={canvasRef}
        />
        {hoveredShape ? (
          <div
            className="chronicle-bubble-tooltip"
            style={{
              left: hoveredShape.x,
              top: hoveredShape.y + hoveredShape.height + 8
            }}
          >
            <strong>{hoveredShape.entry.fileName}</strong>
            <span>{hoveredShape.entry.chronicleCalendarName}: {hoveredShape.entry.startLabel} - {hoveredShape.entry.endLabel}</span>
            <span>{hoveredShape.category ?? t("chronicle.categoryUnset")}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function drawChronicleBubbles(
  context: CanvasRenderingContext2D,
  shapes: ChronicleBubbleShape[],
  hoveredShape: ChronicleBubbleShape | null
): void {
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.font = "13px system-ui, sans-serif";
  context.textBaseline = "middle";

  for (const shape of shapes) {
    const isHovered = shape.id === hoveredShape?.id;
    context.fillStyle = isHovered ? "#2f6f73" : "#f6f2e8";
    context.strokeStyle = isHovered ? "#24575a" : "#c5bfae";
    roundRect(context, shape.x, shape.y, shape.width, shape.height, 18);
    context.fill();
    context.stroke();

    context.fillStyle = isHovered ? "#ffffff" : "#2b2924";
    context.fillText(truncateCanvasText(context, shape.label, shape.width - 28), shape.x + 14, shape.y + shape.height / 2);
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function truncateCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (truncated.length > 1 && context.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }

  return `${truncated}...`;
}
