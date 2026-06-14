import {
  type ChangeEvent as ReactChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from "react";

import { type RelicConnectedDiagramNode } from "../../../shared/diagramMarkdown";
import { nodeFileName } from "./diagramGeometry";

interface DiagramNodeViewProps {
  isDragging: boolean;
  isSelected: boolean;
  node: RelicConnectedDiagramNode;
  nodeTextLabel: string;
  onNodeTextChange?: (nodeId: string, value: string) => void;
  onOutlinePointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  resizeLabel: string;
  x: number;
  y: number;
}

export function DiagramNodeView({
  isDragging,
  isSelected,
  node,
  nodeTextLabel,
  onNodeTextChange,
  onOutlinePointerDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizePointerDown,
  resizeLabel,
  x,
  y
}: DiagramNodeViewProps): ReactElement {
  const freeText = "text" in node ? node.text : null;
  const title = "file" in node ? node.file : freeText ?? "";

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
        minHeight: node.height,
        transform: `translate(${x}px, ${y}px)`,
        width: node.width
      }}
      title={title}
    >
      {freeText === null ? (
        <span className="diagram-canvas-node-name">{"file" in node ? nodeFileName(node.file) : ""}</span>
      ) : (
        <textarea
          aria-label={nodeTextLabel}
          className="diagram-canvas-node-text"
          onChange={(event: ReactChangeEvent<HTMLTextAreaElement>) => onNodeTextChange?.(node.id, event.currentTarget.value)}
          onPointerDown={(event) => event.stopPropagation()}
          value={freeText}
        />
      )}
      {isSelected ? (
        <span className="diagram-canvas-node-outline-hitbox">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <span
              className={`diagram-canvas-node-outline-hit diagram-canvas-node-outline-hit--${side}`}
              data-side={side}
              key={side}
              onPointerDown={(event) => onOutlinePointerDown(node, event)}
            />
          ))}
          <span
            aria-label={resizeLabel}
            className="diagram-canvas-node-resize-hit"
            onPointerDown={(event) => onResizePointerDown(node, event)}
            role="button"
            tabIndex={-1}
          />
        </span>
      ) : null}
    </div>
  );
}
