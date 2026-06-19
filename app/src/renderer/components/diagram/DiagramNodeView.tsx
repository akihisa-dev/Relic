import {
  type ChangeEvent as ReactChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement
} from "react";

import { type RelicConnectedDiagramNode } from "../../../shared/diagramMarkdown";
import {
  diagramNodeBorderColor,
  diagramNodeFillColor
} from "../../diagramAppearance";
import { diagramNodeDisplayLayer } from "./diagramLayering";

interface DiagramNodeViewProps {
  isDragging: boolean;
  isTextEditing: boolean;
  isSelected: boolean;
  connectionTargetState?: "available" | "blocked";
  node: RelicConnectedDiagramNode;
  nodeAriaLabel: string;
  nodeTextDraft?: string;
  nodeTextLabel: string;
  onNodeTextCancel?: () => void;
  onNodeTextChange?: (nodeId: string, value: string) => void;
  onNodeTextCommit?: () => void;
  onNodeTextDoubleClick?: (node: RelicConnectedDiagramNode, event: ReactMouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (node: RelicConnectedDiagramNode, event: ReactMouseEvent<HTMLDivElement>) => void;
  onOutlinePointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onFocus?: (node: RelicConnectedDiagramNode) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerDown: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLElement>) => void;
  renderNodeText?: boolean;
  resizeLabel: string;
  x: number;
  y: number;
}

export function DiagramNodeView({
  isDragging,
  isTextEditing,
  isSelected,
  connectionTargetState,
  node,
  nodeAriaLabel,
  nodeTextDraft,
  nodeTextLabel,
  onNodeTextCancel,
  onNodeTextChange,
  onNodeTextCommit,
  onNodeTextDoubleClick,
  onContextMenu,
  onOutlinePointerDown,
  onPointerCancel,
  onPointerDown,
  onFocus,
  onPointerMove,
  onPointerUp,
  onResizePointerDown,
  renderNodeText = true,
  resizeLabel,
  x,
  y
}: DiagramNodeViewProps): ReactElement {
  const freeText = node.text;
  const isArea = node.shape === "area";
  const title = freeText;
  const shapeClass = `diagram-canvas-node--shape-${node.shape}`;
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
        isSelected ? "diagram-canvas-node--selected" : "",
        connectionTargetState ? `diagram-canvas-node--connection-${connectionTargetState}` : ""
      ].filter(Boolean).join(" ")}
      onPointerCancel={onPointerCancel}
      onContextMenu={(event) => onContextMenu?.(node, event)}
      onDoubleClick={(event) => onNodeTextDoubleClick?.(node, event)}
      onFocus={() => onFocus?.(node)}
      onPointerDown={(event) => onPointerDown(node, event)}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => onPointerUp(node, event)}
      role="button"
      aria-label={nodeAriaLabel}
      style={nodeStyle}
      tabIndex={0}
      title={title}
    >
      {!renderNodeText ? null : !isTextEditing ? (
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
      <span className="diagram-canvas-node-outline-hitbox" aria-hidden={!isSelected}>
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
  const configuredBorder = diagramNodeBorderColor(node);
  const configuredFill = diagramNodeFillColor(node);
  if (node.shape === "area") {
    return {
      "--diagram-node-elevation-filter": "none",
      "--diagram-node-elevation-shadow": "0 0 0 rgba(15, 23, 42, 0)",
      "--diagram-node-layer-border": configuredBorder ?? "color-mix(in srgb, var(--text-3) 58%, var(--border-medium))",
      "--diagram-node-layer-fill": configuredFill ?? "color-mix(in srgb, var(--accent) 8%, var(--bg))"
    };
  }

  return {
    "--diagram-node-elevation-filter": "drop-shadow(0 8px 24px rgba(15, 23, 42, 0.1))",
    "--diagram-node-elevation-shadow": "0 8px 24px rgba(15, 23, 42, 0.1)",
    "--diagram-node-layer-border": configuredBorder ?? "color-mix(in srgb, var(--text-3) 64%, var(--border-medium))",
    "--diagram-node-layer-fill": configuredFill ?? "var(--bg)"
  };
}
