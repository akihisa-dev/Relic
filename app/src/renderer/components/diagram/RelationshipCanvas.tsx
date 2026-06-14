import {
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
  useState
} from "react";

import {
  addRelicDiagramLine,
  moveRelicDiagramNode,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  updateRelicDiagramLineLabel,
  type RelicDiagramNode,
  type RelicRelationshipDiagramDocument
} from "../../../shared/diagramMarkdown";
import { useT } from "../../i18n";
import {
  buildDiagramCanvasLayout,
  buildLineLayouts,
  nodeFileName,
  type DiagramCanvasLineLayout
} from "./diagramGeometry";
import {
  clampZoom,
  screenToCanvasPoint,
  type ViewportState
} from "./diagramViewport";
import { type DiagramCanvasProps } from "./diagramTypes";

const connectActivationDistance = 4;

interface DragState {
  currentX: number;
  currentY: number;
  nodeId: string;
  originalX: number;
  originalY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

interface ConnectState {
  isActive: boolean;
  currentX: number;
  currentY: number;
  fromNodeId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
}

interface PanState {
  originalPanX: number;
  originalPanY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

type DiagramSelection =
  | { id: string; type: "line" }
  | { id: string; type: "node" };

interface LabelEditState {
  lineId: string;
  value: string;
}

export function RelationshipCanvas({
  content,
  diagram,
  fileName,
  onChange
}: DiagramCanvasProps & { diagram: RelicRelationshipDiagramDocument }): ReactElement {
  const t = useT();
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [labelEdit, setLabelEdit] = useState<LabelEditState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [selection, setSelection] = useState<DiagramSelection | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });

  const layout = buildDiagramCanvasLayout(diagram);
  const displayNodes = layout.nodes.map((node) => {
    if (drag?.nodeId !== node.node.id) return node;

    return {
      node: {
        ...node.node,
        x: drag.currentX,
        y: drag.currentY
      },
      x: drag.currentX - layout.originX,
      y: drag.currentY - layout.originY
    };
  });
  const displayLines = buildLineLayouts(diagram.lines, displayNodes);
  const previewLine = connect?.isActive ? {
    currentX: connect.currentX,
    currentY: connect.currentY,
    startX: connect.startX,
    startY: connect.startY
  } : null;
  const startNodeDrag = (node: RelicDiagramNode, event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!onChange) return;

    event.preventDefault();
    setSelection({ id: node.id, type: "node" });
    focusCanvasFrom(event.currentTarget);
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDrag({
      currentX: node.x,
      currentY: node.y,
      nodeId: node.id,
      originalX: node.x,
      originalY: node.y,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    });
  };
  const updateNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pointerId = event.pointerId;
    const clientX = event.clientX;
    const clientY = event.clientY;

    setDrag((current) => {
      if (!current || current.pointerId !== pointerId) return current;

      return {
        ...current,
        currentX: current.originalX + (clientX - current.startClientX) / viewport.zoom,
        currentY: current.originalY + (clientY - current.startClientY) / viewport.zoom
      };
    });
  };
  const finishNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.currentX !== drag.originalX || drag.currentY !== drag.originalY) {
      const moved = moveRelicDiagramNode(content, drag.nodeId, drag.currentX, drag.currentY);
      if (moved.ok) {
        onChange?.(moved.value.content);
      }
    }
    setDrag(null);
  };
  const cancelNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag(null);
  };
  const pointerPositionInCanvas = (event: ReactPointerEvent<HTMLElement>): { x: number; y: number } => {
    const canvas = event.currentTarget.closest(".diagram-canvas") ?? event.currentTarget;
    const rect = canvas.getBoundingClientRect();

    return screenToCanvasPoint(event.clientX, event.clientY, rect, viewport);
  };
  const startPanOnBlank = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!isBlankCanvasTarget(event.target, event.currentTarget)) return;

    event.preventDefault();
    setSelection(null);
    setLabelEdit(null);
    focusCanvasFrom(event.currentTarget);
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setPan({
      originalPanX: viewport.panX,
      originalPanY: viewport.panY,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    });
  };
  const updatePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pan || pan.pointerId !== event.pointerId) return;
    const clientX = event.clientX;
    const clientY = event.clientY;

    setViewport((current) => ({
      ...current,
      panX: pan.originalPanX + clientX - pan.startClientX,
      panY: pan.originalPanY + clientY - pan.startClientY
    }));
  };
  const finishPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pan || pan.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPan(null);
  };
  const handleCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = event.clientX;
    const clientY = event.clientY;
    const deltaY = event.deltaY;

    setViewport((current) => {
      const nextZoom = clampZoom(current.zoom * (deltaY < 0 ? 1.1 : 0.9));
      const pointer = screenToCanvasPoint(clientX, clientY, rect, current);

      return {
        panX: clientX - rect.left - pointer.x * nextZoom,
        panY: clientY - rect.top - pointer.y * nextZoom,
        zoom: nextZoom
      };
    });
  };
  const startConnect = (node: RelicDiagramNode, event: ReactPointerEvent<HTMLElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!onChange) return;

    const pointer = pointerPositionInCanvas(event);

    focusCanvasFrom(event.currentTarget);
    setConnect({
      isActive: false,
      currentX: pointer.x,
      currentY: pointer.y,
      fromNodeId: node.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: pointer.x,
      startY: pointer.y
    });
  };
  const updateConnect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const pointerId = event.pointerId;
    const clientX = event.clientX;
    const clientY = event.clientY;
    const pointer = pointerPositionInCanvas(event);

    setConnect((current) => {
      if (!current || current.pointerId !== pointerId) return current;
      const hasMovedEnough = Math.hypot(
        clientX - current.startClientX,
        clientY - current.startClientY
      ) >= connectActivationDistance;

      return {
        ...current,
        isActive: current.isActive || hasMovedEnough,
        currentX: pointer.x,
        currentY: pointer.y
      };
    });
  };
  const finishConnect = (toNodeId: string, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!connect || connect.pointerId !== event.pointerId) return;
    if (!connect.isActive) {
      setConnect(null);
      return;
    }
    if (connect.fromNodeId === toNodeId) {
      setConnect(null);
      return;
    }

    const added = addRelicDiagramLine(content, connect.fromNodeId, toNodeId);
    if (added.ok) {
      onChange?.(added.value.content);
      setSelection({ id: added.value.line.id, type: "line" });
      setLabelEdit({ lineId: added.value.line.id, value: "" });
    }
    setConnect(null);
  };
  const cancelConnect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!connect || connect.pointerId !== event.pointerId) return;
    setConnect(null);
  };
  const startNodePointer = (node: RelicDiagramNode, event: ReactPointerEvent<HTMLDivElement>): void => {
    startNodeDrag(node, event);
  };
  const startNodeOutlineConnect = (node: RelicDiagramNode, event: ReactPointerEvent<HTMLElement>): void => {
    startConnect(node, event);
  };
  const finishNodePointer = (node: RelicDiagramNode, event: ReactPointerEvent<HTMLDivElement>): void => {
    event.stopPropagation();
    if (connect?.pointerId === event.pointerId) {
      finishConnect(node.id, event);
      return;
    }

    finishNodeDrag(event);
  };
  const selectLine = (lineId: string, event: ReactPointerEvent<SVGPathElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setSelection({ id: lineId, type: "line" });
    focusCanvasFrom(event.currentTarget);
  };
  const beginLabelEdit = (line: DiagramCanvasLineLayout): void => {
    if (!onChange) return;

    setSelection({ id: line.line.id, type: "line" });
    setLabelEdit({
      lineId: line.line.id,
      value: line.line.label
    });
  };
  const startLabelEditFromButton = (
    line: DiagramCanvasLineLayout,
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    beginLabelEdit(line);
  };
  const startLabelEditFromLine = (
    line: DiagramCanvasLineLayout,
    event: ReactMouseEvent<SVGPathElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    beginLabelEdit(line);
    focusCanvasFrom(event.currentTarget);
  };
  const changeLabelEditValue = (value: string): void => {
    setLabelEdit((current) => current ? { ...current, value } : current);
  };
  const commitLabelEdit = (): void => {
    if (!labelEdit || !onChange) return;

    const updated = updateRelicDiagramLineLabel(content, labelEdit.lineId, labelEdit.value);
    if (updated.ok) {
      onChange(updated.value.content);
      setSelection({ id: updated.value.line.id, type: "line" });
    }
    setLabelEdit(null);
  };
  const submitLabelEdit = (event: ReactFormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    commitLabelEdit();
  };
  const cancelLabelEdit = (): void => {
    setLabelEdit(null);
  };
  const clearSelectionOnBlankPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (isBlankCanvasTarget(event.target, event.currentTarget)) {
      setSelection(null);
      setLabelEdit(null);
      focusCanvasFrom(event.currentTarget);
    }
  };
  const deleteSelection = (): void => {
    if (!selection || !onChange) return;

    const deleted = selection.type === "node"
      ? removeRelicDiagramNode(content, selection.id)
      : removeRelicDiagramLine(content, selection.id);

    if (deleted.ok) {
      onChange(deleted.value.content);
      setLabelEdit(null);
      setSelection(null);
    }
  };
  const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!selection) return;

    event.preventDefault();
    deleteSelection();
  };

  return (
    <div
      aria-label={fileName}
      className={`diagram-canvas${pan ? " diagram-canvas--panning" : ""}`}
      onKeyDown={handleCanvasKeyDown}
      onPointerCancel={cancelConnect}
      onPointerDown={startPanOnBlank}
      onPointerMove={(event) => {
        updateConnect(event);
        updatePan(event);
      }}
      onPointerUp={(event) => {
        cancelConnect(event);
        finishPan(event);
      }}
      onWheel={handleCanvasWheel}
      role="img"
      tabIndex={0}
    >
      {layout.nodes.length === 0 ? (
        <p className="diagram-canvas-empty">{t("diagram.emptyCanvas")}</p>
      ) : null}
      <div
        className="diagram-canvas-space"
        onPointerDown={clearSelectionOnBlankPointerDown}
        style={{
          height: layout.height,
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0",
          width: layout.width
        }}
      >
        <svg
          aria-hidden="true"
          className="diagram-canvas-lines"
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
        >
          {displayLines.map((line) => (
            <g key={line.line.id}>
              <path
                className="diagram-canvas-line-hit"
                d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
                onDoubleClick={(event) => startLabelEditFromLine(line, event)}
                onPointerDown={(event) => selectLine(line.line.id, event)}
              />
              <path
                aria-hidden="true"
                className={`diagram-canvas-line${selection?.type === "line" && selection.id === line.line.id ? " diagram-canvas-line--selected" : ""}`}
                d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
                onDoubleClick={(event) => startLabelEditFromLine(line, event)}
                onPointerDown={(event) => selectLine(line.line.id, event)}
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
        <div className="diagram-canvas-labels">
          {displayLines.map((line) => {
            if (labelEdit?.lineId === line.line.id) {
              return (
                <form
                  className="diagram-canvas-label-editor"
                  key={line.line.id}
                  onSubmit={submitLabelEdit}
                  style={{
                    left: line.labelX,
                    top: line.labelY
                  }}
                >
                  <input
                    aria-label={t("diagram.editLineLabel")}
                    autoFocus
                    onBlur={commitLabelEdit}
                    onChange={(event) => changeLabelEditValue(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelLabelEdit();
                      }
                    }}
                    value={labelEdit.value}
                  />
                </form>
              );
            }

            if (!line.label && selection?.type !== "line") return null;
            if (!line.label && selection?.id !== line.line.id) return null;

            return (
              <button
                aria-label={t("diagram.editLineLabel")}
                className={`diagram-canvas-line-label${line.label ? "" : " diagram-canvas-line-label--empty"}`}
                key={line.line.id}
                onPointerDown={(event) => startLabelEditFromButton(line, event)}
                style={{
                  left: line.labelX,
                  top: line.labelY
                }}
                type="button"
              >
                {line.label || t("diagram.addLineLabel")}
              </button>
            );
          })}
        </div>
        <div className="diagram-canvas-nodes">
          {displayNodes.map(({ node, x, y }) => (
            <div
              className={[
                "diagram-canvas-node",
                drag?.nodeId === node.id ? "diagram-canvas-node--dragging" : "",
                selection?.type === "node" && selection.id === node.id ? "diagram-canvas-node--selected" : ""
              ].filter(Boolean).join(" ")}
              key={node.id}
              onPointerCancel={cancelNodeDrag}
              onPointerDown={(event) => startNodePointer(node, event)}
              onPointerMove={updateNodeDrag}
              onPointerUp={(event) => finishNodePointer(node, event)}
              style={{
                left: x,
                minHeight: node.height,
                top: y,
                width: node.width
              }}
              title={node.file}
            >
              <span className="diagram-canvas-node-name">{nodeFileName(node.file)}</span>
              {selection?.type === "node" && selection.id === node.id ? (
                <span className="diagram-canvas-node-outline-hitbox" aria-hidden="true">
                  {(["top", "right", "bottom", "left"] as const).map((side) => (
                    <span
                      className={`diagram-canvas-node-outline-hit diagram-canvas-node-outline-hit--${side}`}
                      data-side={side}
                      key={side}
                      onPointerDown={(event) => startNodeOutlineConnect(node, event)}
                    />
                  ))}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function isBlankCanvasTarget(target: EventTarget, currentTarget: Element): boolean {
  return target === currentTarget ||
    (target instanceof Element && target.tagName.toLowerCase() === "svg") ||
    (target instanceof Element && target.classList.contains("diagram-canvas-empty")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-lines")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-labels")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-nodes")) ||
    (target instanceof Element && target.classList.contains("diagram-canvas-space"));
}

function focusCanvasFrom(element: Element): void {
  const canvas = element.closest(".diagram-canvas");
  if (canvas instanceof HTMLElement) {
    canvas.focus({ preventScroll: true });
  }
}
