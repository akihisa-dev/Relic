import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  Fragment,
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
    displayLayer: number;
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
    <Fragment>
      <svg
        aria-hidden="true"
        className="diagram-canvas-lines diagram-canvas-lines--defs"
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
      </svg>
      {lines.map((line) => {
        const lineStyle: CSSProperties = {
          zIndex: line.displayLayer
        };

        return (
          <svg
            aria-hidden="true"
            className="diagram-canvas-lines"
            height={height}
            key={line.line.id}
            style={lineStyle}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
          >
            <path
              className="diagram-canvas-line-hit"
              d={line.pathD}
              onDoubleClick={(event) => onLineDoubleClick(line, event)}
              onPointerDown={(event) => onLinePointerDown(line.line.id, event)}
            />
            <path
              aria-hidden="true"
              className={[
                "diagram-canvas-line",
                line.kind === "annotation" ? "diagram-canvas-line--annotation" : "",
                selection?.type === "line" && selection.id === line.line.id ? "diagram-canvas-line--selected" : ""
              ].filter(Boolean).join(" ")}
              d={line.pathD}
              markerEnd={line.kind === "annotation" ? undefined : `url(#${markerId})`}
              onDoubleClick={(event) => onLineDoubleClick(line, event)}
              onPointerDown={(event) => onLinePointerDown(line.line.id, event)}
            />
          </svg>
        );
      })}
      {previewLine ? (
        <svg
          aria-hidden="true"
          className="diagram-canvas-lines diagram-canvas-lines--preview-layer"
          height={height}
          style={{ zIndex: previewLine.displayLayer }}
          viewBox={`0 0 ${width} ${height}`}
          width={width}
        >
          <path
            className="diagram-canvas-line diagram-canvas-line--preview"
            d={`M ${previewLine.startX} ${previewLine.startY} L ${previewLine.currentX} ${previewLine.currentY}`}
          />
        </svg>
      ) : null}
    </Fragment>
  );
}
