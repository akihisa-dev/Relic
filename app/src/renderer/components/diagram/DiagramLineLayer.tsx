import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  useId
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
  const markerId = `diagram-canvas-arrow-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      className="diagram-canvas-lines"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <defs>
        <marker
          id={markerId}
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="4"
          viewBox="0 0 8 8"
        >
          <path className="diagram-canvas-arrow-marker" d="M 0 0 L 8 4 L 0 8 z" />
        </marker>
      </defs>
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
            markerEnd={`url(#${markerId})`}
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
