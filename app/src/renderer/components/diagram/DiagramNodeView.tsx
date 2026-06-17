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
  isLayerBackwardDisabled?: boolean;
  isLayerForwardDisabled?: boolean;
  isTextEditing: boolean;
  isSelected: boolean;
  layerBackwardLabel: string;
  layerFeedbackDirection?: -1 | 1;
  layerForwardLabel: string;
  layerLabel?: string;
  layerRelation?: "above" | "below" | "same";
  node: RelicConnectedDiagramNode;
  nodeTextDraft?: string;
  nodeTextLabel: string;
  onLayerBackwardPointerDown?: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onLayerForwardPointerDown?: (node: RelicConnectedDiagramNode, event: ReactPointerEvent<HTMLButtonElement>) => void;
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
  resizeLabel: string;
  x: number;
  y: number;
}

export function DiagramNodeView({
  addShapeLabel,
  addShapeMenuLabel,
  addShapeOptions,
  isDragging,
  isLayerBackwardDisabled = false,
  isLayerForwardDisabled = false,
  isTextEditing,
  isSelected,
  layerBackwardLabel,
  layerFeedbackDirection,
  layerForwardLabel,
  layerLabel,
  layerRelation,
  node,
  nodeTextDraft,
  nodeTextLabel,
  onLayerBackwardPointerDown,
  onLayerForwardPointerDown,
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
  resizeLabel,
  x,
  y
}: DiagramNodeViewProps): ReactElement {
  const freeText = "text" in node ? node.text : null;
  const isArea = "shape" in node && node.shape === "area";
  const hasLayerFeedback = isSelected && layerFeedbackDirection !== undefined;
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
        layerRelation === "above" ? "diagram-canvas-node--layer-above-selected" : "",
        layerRelation === "below" ? "diagram-canvas-node--layer-below-selected" : "",
        layerRelation === "same" ? "diagram-canvas-node--layer-same-selected" : "",
        hasLayerFeedback ? "diagram-canvas-node--layer-feedback" : "",
        layerFeedbackDirection === 1 ? "diagram-canvas-node--layer-feedback-forward" : "",
        layerFeedbackDirection === -1 ? "diagram-canvas-node--layer-feedback-backward" : "",
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
      {freeText === null ? (
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
      {isSelected && (onLayerBackwardPointerDown || onLayerForwardPointerDown) ? (
        <span className="diagram-canvas-node-layer-controls" aria-label={layerForwardLabel}>
          {layerLabel ? (
            <span
              aria-live="polite"
              className={[
                "diagram-canvas-node-layer-badge",
                hasLayerFeedback ? "diagram-canvas-node-layer-badge--changed" : ""
              ].filter(Boolean).join(" ")}
            >
              {layerLabel}
            </span>
          ) : null}
          <button
            aria-label={layerBackwardLabel}
            className="diagram-canvas-node-layer-button"
            data-tooltip={layerBackwardLabel}
            disabled={isLayerBackwardDisabled}
            onPointerDown={(event) => onLayerBackwardPointerDown?.(node, event)}
            title={layerBackwardLabel}
            type="button"
          >
            <LayerBackIcon />
          </button>
          <button
            aria-label={layerForwardLabel}
            className="diagram-canvas-node-layer-button"
            data-tooltip={layerForwardLabel}
            disabled={isLayerForwardDisabled}
            onPointerDown={(event) => onLayerForwardPointerDown?.(node, event)}
            title={layerForwardLabel}
            type="button"
          >
            <LayerFrontIcon />
          </button>
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

  const cappedLayer = Math.min(Math.max(1, Math.round(node.layer)), 8);
  const edgeOffsetY = cappedLayer;
  const shadowOffsetY = 8 + cappedLayer * 4;
  const shadowBlur = 18 + cappedLayer * 7;
  const edgeAlpha = (0.06 + cappedLayer * 0.018).toFixed(3);
  const outlineAccent = Math.min(10 + cappedLayer * 7, 66);
  const shadowAlpha = (0.11 + cappedLayer * 0.026).toFixed(3);
  const fillTextMix = Math.min(4 + cappedLayer * 2, 20);
  const fillBgMix = 100 - fillTextMix;

  return {
    "--diagram-node-elevation-filter": [
      `drop-shadow(0 ${edgeOffsetY}px 0 rgba(15, 23, 42, ${edgeAlpha}))`,
      `drop-shadow(0 ${shadowOffsetY}px ${shadowBlur}px rgba(15, 23, 42, ${shadowAlpha}))`
    ].join(" "),
    "--diagram-node-elevation-shadow": [
      `0 0 0 1px color-mix(in srgb, var(--accent) ${outlineAccent}%, transparent)`,
      `inset 0 -${edgeOffsetY}px 0 color-mix(in srgb, var(--text) ${fillTextMix}%, transparent)`,
      `0 ${edgeOffsetY}px 0 rgba(15, 23, 42, ${edgeAlpha})`,
      `0 ${shadowOffsetY}px ${shadowBlur}px rgba(15, 23, 42, ${shadowAlpha})`
    ].join(", "),
    "--diagram-node-layer-border": `color-mix(in srgb, var(--accent) ${outlineAccent}%, color-mix(in srgb, var(--text-3) 64%, var(--border-medium)))`,
    "--diagram-node-layer-fill": `linear-gradient(180deg, var(--bg) 0%, var(--bg) 58%, color-mix(in srgb, var(--bg) ${fillBgMix}%, var(--text) ${fillTextMix}%) 100%)`
  };
}

function LayerBackIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="M 6 8 H 18" />
      <path d="M 6 14 H 18" />
      <path d="M 12 20 V 4" />
      <path d="M 8 16 L 12 20 L 16 16" />
    </svg>
  );
}

function LayerFrontIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
      <path d="M 6 10 H 18" />
      <path d="M 6 16 H 18" />
      <path d="M 12 4 V 20" />
      <path d="M 8 8 L 12 4 L 16 8" />
    </svg>
  );
}
