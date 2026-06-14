import {
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from "react";

import { type RelicDiagramNode } from "../../../shared/diagramMarkdown";
import { nodeFileName } from "./diagramGeometry";

interface DiagramNodeViewProps {
  isDragging: boolean;
  isSelected: boolean;
  node: RelicDiagramNode;
  onOutlinePointerDown: (node: RelicDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown: (node: RelicDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (node: RelicDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  x: number;
  y: number;
}

export function DiagramNodeView({
  isDragging,
  isSelected,
  node,
  onOutlinePointerDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  x,
  y
}: DiagramNodeViewProps): ReactElement {
  return (
    <div
      className={[
        "diagram-canvas-node",
        isDragging ? "diagram-canvas-node--dragging" : "",
        isSelected ? "diagram-canvas-node--selected" : ""
      ].filter(Boolean).join(" ")}
      onPointerCancel={onPointerCancel}
      onPointerDown={(event) => onPointerDown(node, event)}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerUp(node, event)}
      style={{
        left: x,
        minHeight: node.height,
        top: y,
        width: node.width
      }}
      title={node.file}
    >
      <span className="diagram-canvas-node-name">{nodeFileName(node.file)}</span>
      {isSelected ? (
        <span className="diagram-canvas-node-outline-hitbox" aria-hidden="true">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <span
              className={`diagram-canvas-node-outline-hit diagram-canvas-node-outline-hit--${side}`}
              data-side={side}
              key={side}
              onPointerDown={(event) => onOutlinePointerDown(node, event)}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}
