import {
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
  useMemo,
  useState
} from "react";

import {
  addRelicMapLine,
  moveRelicMapNode,
  parseRelicMapMarkdown,
  removeRelicMapLine,
  removeRelicMapNode,
  updateRelicMapLineLabel,
  type RelicMapDocument,
  type RelicMapLine,
  type RelicMapNode
} from "../../shared/mapMarkdown";
import { useT } from "../i18n";

interface MapCanvasProps {
  content: string;
  fileName: string;
  onChange?: (content: string) => void;
}

interface MapCanvasLayout {
  height: number;
  lines: MapCanvasLineLayout[];
  nodes: MapCanvasNodeLayout[];
  originX: number;
  originY: number;
  width: number;
}

interface MapCanvasNodeLayout {
  node: RelicMapNode;
  x: number;
  y: number;
}

interface MapCanvasLineLayout {
  label: string;
  line: RelicMapLine;
  labelX: number;
  labelY: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

const canvasPadding = 180;
const minCanvasWidth = 900;
const minCanvasHeight = 620;
const minZoom = 0.35;
const maxZoom = 2.5;

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
  currentX: number;
  currentY: number;
  fromNodeId: string;
  pointerId: number;
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

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

type MapSelection =
  | { id: string; type: "line" }
  | { id: string; type: "node" };

interface LabelEditState {
  lineId: string;
  value: string;
}

export function MapCanvas({ content, fileName, onChange }: MapCanvasProps): ReactElement {
  const t = useT();
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [labelEdit, setLabelEdit] = useState<LabelEditState | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const parsed = useMemo(() => parseRelicMapMarkdown(content), [content]);

  if (!parsed.ok) {
    return (
      <div className="map-canvas map-canvas--invalid" role="alert">
        <p>{t("map.invalidFile")}</p>
      </div>
    );
  }

  const layout = buildMapCanvasLayout(parsed.value);
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
  const displayLines = buildLineLayouts(parsed.value.lines, displayNodes);
  const previewLine = connect ? {
    currentX: connect.currentX,
    currentY: connect.currentY,
    startX: connect.startX,
    startY: connect.startY
  } : null;
  const startNodeDrag = (node: RelicMapNode, event: ReactPointerEvent<HTMLDivElement>): void => {
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
    setDrag((current) => {
      if (!current || current.pointerId !== event.pointerId) return current;

      return {
        ...current,
        currentX: current.originalX + (event.clientX - current.startClientX) / viewport.zoom,
        currentY: current.originalY + (event.clientY - current.startClientY) / viewport.zoom
      };
    });
  };
  const finishNodeDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.currentX !== drag.originalX || drag.currentY !== drag.originalY) {
      const moved = moveRelicMapNode(content, drag.nodeId, drag.currentX, drag.currentY);
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
    const canvas = event.currentTarget.closest(".map-canvas") ?? event.currentTarget;
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

    setViewport((current) => ({
      ...current,
      panX: pan.originalPanX + event.clientX - pan.startClientX,
      panY: pan.originalPanY + event.clientY - pan.startClientY
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

    setViewport((current) => {
      const nextZoom = clampZoom(current.zoom * (event.deltaY < 0 ? 1.1 : 0.9));
      const pointer = screenToCanvasPoint(event.clientX, event.clientY, rect, current);

      return {
        panX: event.clientX - rect.left - pointer.x * nextZoom,
        panY: event.clientY - rect.top - pointer.y * nextZoom,
        zoom: nextZoom
      };
    });
  };
  const nodeCenter = (nodeId: string): { x: number; y: number } | null => {
    const item = displayNodes.find((node) => node.node.id === nodeId);
    if (!item) return null;

    return {
      x: item.x + item.node.width / 2,
      y: item.y + item.node.height / 2
    };
  };
  const startConnect = (nodeId: string, event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!onChange) return;

    const center = nodeCenter(nodeId);
    if (!center) return;

    event.preventDefault();
    event.stopPropagation();
    setConnect({
      currentX: center.x,
      currentY: center.y,
      fromNodeId: nodeId,
      pointerId: event.pointerId,
      startX: center.x,
      startY: center.y
    });
  };
  const updateConnect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    setConnect((current) => {
      if (!current || current.pointerId !== event.pointerId) return current;
      const pointer = pointerPositionInCanvas(event);

      return {
        ...current,
        currentX: pointer.x,
        currentY: pointer.y
      };
    });
  };
  const finishConnect = (toNodeId: string, event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (!connect || connect.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    const added = addRelicMapLine(content, connect.fromNodeId, toNodeId);
    if (added.ok) {
      onChange?.(added.value.content);
      setSelection({ id: added.value.line.id, type: "line" });
    }
    setConnect(null);
  };
  const cancelConnect = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!connect || connect.pointerId !== event.pointerId) return;
    setConnect(null);
  };
  const stopNodeControlMouseEvent = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
  };
  const selectLine = (lineId: string, event: ReactPointerEvent<SVGPathElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    setSelection({ id: lineId, type: "line" });
    focusCanvasFrom(event.currentTarget);
  };
  const beginLabelEdit = (line: MapCanvasLineLayout): void => {
    if (!onChange) return;

    setSelection({ id: line.line.id, type: "line" });
    setLabelEdit({
      lineId: line.line.id,
      value: line.line.label
    });
  };
  const startLabelEditFromButton = (
    line: MapCanvasLineLayout,
    event: ReactPointerEvent<HTMLButtonElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    beginLabelEdit(line);
  };
  const startLabelEditFromLine = (
    line: MapCanvasLineLayout,
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

    const updated = updateRelicMapLineLabel(content, labelEdit.lineId, labelEdit.value);
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
      ? removeRelicMapNode(content, selection.id)
      : removeRelicMapLine(content, selection.id);

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
      className={`map-canvas${pan ? " map-canvas--panning" : ""}`}
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
        <p className="map-canvas-empty">{t("map.emptyCanvas")}</p>
      ) : null}
      <div
        className="map-canvas-space"
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
          className="map-canvas-lines"
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
        >
          {displayLines.map((line) => (
            <g key={line.line.id}>
              <path
                className={`map-canvas-line${selection?.type === "line" && selection.id === line.line.id ? " map-canvas-line--selected" : ""}`}
                d={`M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`}
                onDoubleClick={(event) => startLabelEditFromLine(line, event)}
                onPointerDown={(event) => selectLine(line.line.id, event)}
              />
            </g>
          ))}
          {previewLine ? (
            <path
              className="map-canvas-line map-canvas-line--preview"
              d={`M ${previewLine.startX} ${previewLine.startY} L ${previewLine.currentX} ${previewLine.currentY}`}
            />
          ) : null}
        </svg>
        <div className="map-canvas-labels">
          {displayLines.map((line) => {
            if (labelEdit?.lineId === line.line.id) {
              return (
                <form
                  className="map-canvas-label-editor"
                  key={line.line.id}
                  onSubmit={submitLabelEdit}
                  style={{
                    left: line.labelX,
                    top: line.labelY
                  }}
                >
                  <input
                    aria-label={t("map.editLineLabel")}
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

            if (!line.label) return null;

            return (
              <button
                aria-label={t("map.editLineLabel")}
                className="map-canvas-line-label"
                key={line.line.id}
                onPointerDown={(event) => startLabelEditFromButton(line, event)}
                style={{
                  left: line.labelX,
                  top: line.labelY
                }}
                type="button"
              >
                {line.label}
              </button>
            );
          })}
        </div>
        <div className="map-canvas-nodes">
          {displayNodes.map(({ node, x, y }) => (
            <div
              className={[
                "map-canvas-node",
                drag?.nodeId === node.id ? "map-canvas-node--dragging" : "",
                selection?.type === "node" && selection.id === node.id ? "map-canvas-node--selected" : ""
              ].filter(Boolean).join(" ")}
              key={node.id}
              onPointerCancel={cancelNodeDrag}
              onPointerDown={(event) => startNodeDrag(node, event)}
              onPointerMove={updateNodeDrag}
              onPointerUp={finishNodeDrag}
              style={{
                left: x,
                minHeight: node.height,
                top: y,
                width: node.width
              }}
              title={node.file}
            >
              <span className="map-canvas-node-name">{nodeFileName(node.file)}</span>
              <span className="map-canvas-node-path">{node.file}</span>
              <button
                aria-label={t("map.connectNode", { name: nodeFileName(node.file) })}
                className="map-canvas-node-connect"
                onClick={stopNodeControlMouseEvent}
                onDoubleClick={stopNodeControlMouseEvent}
                onPointerDown={(event) => startConnect(node.id, event)}
                onPointerUp={(event) => finishConnect(node.id, event)}
                title={t("map.connectNode", { name: nodeFileName(node.file) })}
                type="button"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function mapCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicMapMarkdown(content);
  if (!parsed.ok) return t("map.invalidStatus");

  return t("map.status", {
    lines: parsed.value.lines.length,
    nodes: parsed.value.nodes.length
  });
}

function buildMapCanvasLayout(map: RelicMapDocument): MapCanvasLayout {
  if (map.nodes.length === 0) {
    return {
      height: minCanvasHeight,
      lines: [],
      nodes: [],
      originX: 0,
      originY: 0,
      width: minCanvasWidth
    };
  }

  const minX = Math.min(...map.nodes.map((node) => node.x));
  const minY = Math.min(...map.nodes.map((node) => node.y));
  const maxX = Math.max(...map.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...map.nodes.map((node) => node.y + node.height));
  const originX = minX - canvasPadding;
  const originY = minY - canvasPadding;
  const nodes = map.nodes.map((node) => ({
    node,
    x: node.x - originX,
    y: node.y - originY
  }));

  return {
    height: Math.max(minCanvasHeight, maxY - minY + canvasPadding * 2),
    lines: buildLineLayouts(map.lines, nodes),
    nodes,
    originX,
    originY,
    width: Math.max(minCanvasWidth, maxX - minX + canvasPadding * 2)
  };
}

function buildLineLayouts(
  lines: RelicMapLine[],
  nodes: MapCanvasNodeLayout[]
): MapCanvasLineLayout[] {
  const nodeById = new Map(nodes.map((node) => [node.node.id, node]));

  return lines.flatMap((line) => {
    const from = nodeById.get(line.from);
    const to = nodeById.get(line.to);
    if (!from || !to) return [];

    const x1 = from.x + from.node.width / 2;
    const y1 = from.y + from.node.height / 2;
    const x2 = to.x + to.node.width / 2;
    const y2 = to.y + to.node.height / 2;

    return [{
      label: line.label,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2 - 8,
      line,
      x1,
      x2,
      y1,
      y2
    }];
  });
}

function nodeFileName(filePath: string): string {
  const name = filePath.split("/").at(-1) ?? filePath;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

function screenToCanvasPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  viewport: ViewportState
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.panX) / viewport.zoom,
    y: (clientY - rect.top - viewport.panY) / viewport.zoom
  };
}

function clampZoom(value: number): number {
  return Math.min(maxZoom, Math.max(minZoom, value));
}

function isBlankCanvasTarget(target: EventTarget, currentTarget: Element): boolean {
  return target === currentTarget ||
    (target instanceof Element && target.tagName.toLowerCase() === "svg") ||
    (target instanceof Element && target.classList.contains("map-canvas-space"));
}

function focusCanvasFrom(element: Element): void {
  const canvas = element.closest(".map-canvas");
  if (canvas instanceof HTMLElement) {
    canvas.focus({ preventScroll: true });
  }
}
