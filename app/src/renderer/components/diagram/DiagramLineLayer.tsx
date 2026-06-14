import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from "react";

import { type DiagramCanvasLineLayout } from "./diagramGeometry";

type DiagramLineSelection =
  | { id: string; type: "line" }
  | { id: string; type: "node" }
  | null;

interface DiagramLineLayerProps {
  height: number;
  lines: DiagramCanvasLineLayout[];
  onLineDoubleClick: (line: DiagramCanvasLineLayout, event: ReactMouseEvent<SVGPathElement>) => void;
  onLinePointerDown: (lineId: string, event: ReactPointerEvent<SVGPathElement>) => void;
  previewLine: {
    currentX: number;
    currentY: number;
    startX: number;
    startY: number;
  } | null;
  selection: DiagramLineSelection;
  width: number;
}

export function DiagramLineLayer({
  height,
  lines,
  onLineDoubleClick,
  onLinePointerDown,
  previewLine,
  selection,
  width
}: DiagramLineLayerProps): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="diagram-canvas-lines"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {lines.map((line) => (
        <g key={line.line.id}>
          <path
            className="diagram-canvas-line-hit"
            d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
            onDoubleClick={(event) => onLineDoubleClick(line, event)}
            onPointerDown={(event) => onLinePointerDown(line.line.id, event)}
          />
          <path
            aria-hidden="true"
            className={`diagram-canvas-line${selection?.type === "line" && selection.id === line.line.id ? " diagram-canvas-line--selected" : ""}`}
            d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
            onDoubleClick={(event) => onLineDoubleClick(line, event)}
            onPointerDown={(event) => onLinePointerDown(line.line.id, event)}
          />
        </g>
      ))}
      {previewLine ? (
        <path
          className="diagram-canvas-line diagram-canvas-line--preview"
          d={`M ${previewLine.startX} ${previewLine.startY} L ${previewLine.currentX} ${previewLine.currentY}`}
        />
      ) : null}
    </svg>
  );
}
