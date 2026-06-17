import {
  type ChangeEvent as ReactChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from "react";

import { type RelicConnectedDiagramNode, type RelicFreeDrawingShapeType } from "../../../shared/diagramMarkdown";
import { diagramNodeDisplayLayer } from "./diagramLayering";
import { nodeFileName } from "./diagramGeometry";

interface DiagramNodeViewProps {
  addShapeLabel?: string;
  addShapeMenuLabel?: string;
  addShapeOptions?: ReadonlyArray<{
    label: string;
    shape: RelicFreeDrawingShapeType;
  }>;
  isDragging: boolean;
  isTextEditing: boolean;
  isSelected: boolean;
  node: RelicConnectedDiagramNode;
  nodeTextDraft?: string;
  nodeTextLabel: string;
  onNodeTextCancel?: () => void;
  onNodeTextChange?: (nodeId: string, value: string) => void;
  onNodeTextCommit?: () => void;
  onNodeTextDoubleClick?: (node: RelicConnectedDiagramNode, event: ReactMouseEvent<HTMLDivElement>) => void;
  onOutlinePointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  onShapeAddButtonPointerDown?: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onShapeOptionPointerDown?: (
    node: RelicConnectedDiagramNode,
    shape: RelicFreeDrawingShapeType,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  renderNodeText?: boolean;
  resizeLabel: string;
  x: number;
  y: number;
}

export function DiagramNodeView({
  addShapeLabel,
  addShapeMenuLabel,
  addShapeOptions,
  isDragging,
  isTextEditing,
  isSelected,
  node,
  nodeTextDraft,
  nodeTextLabel,
  onNodeTextCancel,
  onNodeTextChange,
  onNodeTextCommit,
  onNodeTextDoubleClick,
  onOutlinePointerDown,
  onShapeAddButtonPointerDown,
  onShapeOptionPointerDown,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onResizePointerDown,
  renderNodeText = true,
  resizeLabel,
  x,
  y
}: DiagramNodeViewProps): ReactElement {
  const freeText = "text" in node ? node.text : null;
  const isArea = "shape" in node && node.shape === "area";
  const title = "file" in node ? node.file : freeText ?? "";
  const shapeClass = "shape" in node ? `diagram-canvas-node--shape-${node.shape}` : "";
  const nodeStyle: DiagramNodeStyle = {
    ...nodeElevationStyle(node),
    minHeight: node.height,
    transform: `translate(${x}px, ${y}px)`,
    zIndex: diagramNodeDisplayLayer(node, isDragging, isSelected),
    width: node.width
  };
  const handleNodeTextKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onNodeTextCancel?.();
  };

  return (
    <div
      className={[
        "diagram-canvas-node",
        shapeClass,
        isDragging ? "diagram-canvas-node--dragging" : "",
        isSelected ? "diagram-canvas-node--selected" : ""
      ].filter(Boolean).join(" ")}
      onPointerCancel={onPointerCancel}
      onDoubleClick={(event) => onNodeTextDoubleClick?.(node, event)}
      onPointerDown={(event) => onPointerDown(node, event)}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerUp(node, event)}
      style={nodeStyle}
      title={title}
    >
      {!renderNodeText ? null : freeText === null ? (
        <span className="diagram-canvas-node-name">{"file" in node ? nodeFileName(node.file) : ""}</span>
      ) : !isTextEditing ? (
        <span className={[
          "diagram-canvas-node-name",
          "diagram-canvas-node-name--free-text",
          isArea ? "diagram-canvas-node-name--area-name" : ""
        ].filter(Boolean).join(" ")}
        >
          {freeText || nodeTextLabel}
        </span>
      ) : (
        <textarea
          aria-label={nodeTextLabel}
          autoFocus
          className={[
            "diagram-canvas-node-text",
            isArea ? "diagram-canvas-node-text--area-name" : ""
          ].filter(Boolean).join(" ")}
          onChange={(event: ReactChangeEvent<HTMLTextAreaElement>) => onNodeTextChange?.(node.id, event.currentTarget.value)}
          onBlur={onNodeTextCommit}
          onKeyDown={handleNodeTextKeyDown}
          onPointerDown={(event) => event.stopPropagation()}
          value={nodeTextDraft ?? freeText}
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
          <button
            aria-label={resizeLabel}
            className="diagram-canvas-node-resize-hit"
            onPointerDown={(event) => onResizePointerDown(node, event)}
            tabIndex={-1}
            type="button"
          />
        </span>
      ) : null}
      {isSelected && addShapeLabel ? (
        <span className="diagram-canvas-node-add-shape">
          <button
            aria-label={addShapeLabel}
            className="diagram-canvas-node-add-shape-button"
            onPointerDown={(event) => onShapeAddButtonPointerDown?.(node, event)}
            type="button"
          >
            +
          </button>
          {addShapeMenuLabel && addShapeOptions && addShapeOptions.length > 0 ? (
            <span className="diagram-canvas-node-add-shape-menu" role="menu" aria-label={addShapeMenuLabel}>
              {addShapeOptions.map((option) => (
                <button
                  className={`diagram-canvas-node-add-shape-option diagram-canvas-node-add-shape-option--${option.shape}`}
                  key={option.shape}
                  onPointerDown={(event) => onShapeOptionPointerDown?.(node, option.shape, event)}
                  role="menuitem"
                  type="button"
                >
                  <span className="diagram-canvas-node-add-shape-icon" aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

type DiagramNodeStyle = CSSProperties & {
  "--diagram-node-elevation-filter": string;
  "--diagram-node-elevation-shadow": string;
  "--diagram-node-layer-border": string;
  "--diagram-node-layer-fill": string;
};

function nodeElevationStyle(node: RelicConnectedDiagramNode): Pick<
  DiagramNodeStyle,
  "--diagram-node-elevation-filter" |
  "--diagram-node-elevation-shadow" |
  "--diagram-node-layer-border" |
  "--diagram-node-layer-fill"
> {
  if (!("layer" in node)) {
    return {
      "--diagram-node-elevation-filter": "drop-shadow(0 8px 24px rgba(15, 23, 42, 0.1))",
      "--diagram-node-elevation-shadow": "0 8px 24px rgba(15, 23, 42, 0.1)",
      "--diagram-node-layer-border": "color-mix(in srgb, var(--text-3) 64%, var(--border-medium))",
      "--diagram-node-layer-fill": "var(--bg)"
    };
  }
  if (node.shape === "area") {
    return {
      "--diagram-node-elevation-filter": "none",
      "--diagram-node-elevation-shadow": "0 0 0 rgba(15, 23, 42, 0)",
      "--diagram-node-layer-border": "color-mix(in srgb, var(--text-3) 58%, var(--border-medium))",
      "--diagram-node-layer-fill": "color-mix(in srgb, var(--accent) 8%, var(--bg))"
    };
  }

  return {
    "--diagram-node-elevation-filter": "drop-shadow(0 8px 24px rgba(15, 23, 42, 0.1))",
    "--diagram-node-elevation-shadow": "0 8px 24px rgba(15, 23, 42, 0.1)",
    "--diagram-node-layer-border": "color-mix(in srgb, var(--text-3) 64%, var(--border-medium))",
    "--diagram-node-layer-fill": "var(--bg)"
  };
}
