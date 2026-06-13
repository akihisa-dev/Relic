import {
  type ChangeEvent as ReactChangeEvent,
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
  addRelicDiagramLine,
  addRelicWhyTreeSupplement,
  addRelicWhyTreeWhy,
  moveRelicDiagramNode,
  parseRelicDiagramMarkdown,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  removeRelicWhyTreeSupplement,
  removeRelicWhyTreeWhy,
  updateRelicDiagramLineLabel,
  updateRelicWhyTreeSupplement,
  updateRelicWhyTreeTitle,
  type RelicDiagramLine,
  type RelicDiagramNode,
  type RelicRelationshipDiagramDocument,
  type RelicWhyTreeDocument,
  type RelicWhyTreeNode,
  type RelicWhyTreeSupplementKind
} from "../../shared/diagramMarkdown";
import { useT } from "../i18n";

interface DiagramCanvasProps {
  content: string;
  fileName: string;
  onChange?: (content: string) => void;
}

interface DiagramCanvasLayout {
  height: number;
  lines: DiagramCanvasLineLayout[];
  nodes: DiagramCanvasNodeLayout[];
  originX: number;
  originY: number;
  width: number;
}

interface DiagramCanvasNodeLayout {
  node: RelicDiagramNode;
  x: number;
  y: number;
}

interface DiagramCanvasLineLayout {
  label: string;
  line: RelicDiagramLine;
  labelX: number;
  labelY: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

interface WhyTreeChainItem {
  node: RelicWhyTreeNode;
  path: number[];
  role: "phenomenon" | "why";
}

type WhyTreeSelection =
  | { kind: "phenomenon" | "why"; path: number[] }
  | { index: number; kind: RelicWhyTreeSupplementKind; path: number[] };

type WhyTreeUpdateResult = { ok: true; value: { content: string } } | { ok: false };

const canvasPadding = 180;
const minCanvasWidth = 900;
const minCanvasHeight = 620;
const minZoom = 0.35;
const maxZoom = 2.5;
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

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

type DiagramSelection =
  | { id: string; type: "line" }
  | { id: string; type: "node" };

interface LabelEditState {
  lineId: string;
  value: string;
}

export function DiagramCanvas({ content, fileName, onChange }: DiagramCanvasProps): ReactElement {
  const t = useT();
  const parsed = useMemo(() => parseRelicDiagramMarkdown(content), [content]);

  if (!parsed.ok) {
    return (
      <div className="diagram-canvas diagram-canvas--invalid" role="alert">
        <p>{t("diagram.invalidFile")}</p>
      </div>
    );
  }

  return parsed.value.type === "why-tree" ? (
    <WhyTreeEditor content={content} fileName={fileName} onChange={onChange} tree={parsed.value} />
  ) : (
    <RelationshipCanvas content={content} diagram={parsed.value} fileName={fileName} onChange={onChange} />
  );
}

function RelationshipCanvas({
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

function WhyTreeEditor({
  content,
  fileName,
  onChange,
  tree
}: DiagramCanvasProps & { tree: RelicWhyTreeDocument }): ReactElement {
  const t = useT();
  const [selection, setSelection] = useState<WhyTreeSelection>({ kind: "phenomenon", path: [] });

  const applyUpdate = (updated: WhyTreeUpdateResult): void => {
    if (updated.ok) {
      onChange?.(updated.value.content);
    }
  };
  const selectMainNode = (item: WhyTreeChainItem): void => {
    setSelection({ kind: item.role, path: item.path });
  };
  const addSupplementFromPath = (path: number[], kind: RelicWhyTreeSupplementKind): void => {
    if (!onChange) return;
    applyUpdate(addRelicWhyTreeSupplement(content, path, kind));
  };
  const changeMainTitle = (path: number[], value: string): void => {
    if (!onChange) return;
    applyUpdate(updateRelicWhyTreeTitle(content, path, value));
  };
  const changeSupplement = (
    path: number[],
    kind: RelicWhyTreeSupplementKind,
    index: number,
    event: ReactChangeEvent<HTMLInputElement>
  ): void => {
    if (!onChange) return;
    applyUpdate(updateRelicWhyTreeSupplement(content, path, kind, index, event.currentTarget.value));
  };
  const selectSupplement = (path: number[], kind: RelicWhyTreeSupplementKind, index: number): void => {
    setSelection({ index, kind, path });
  };
  const selectParentMainNode = (path: number[]): void => {
    setSelection(path.length === 0 ? { kind: "phenomenon", path: [] } : { kind: "why", path });
  };
  const removeMainWhy = (path: number[]): void => {
    if (!onChange || path.length === 0) return;
    applyUpdate(removeRelicWhyTreeWhy(content, path));
    setSelection({ kind: "phenomenon", path: [] });
  };
  const removeSupplement = (path: number[], kind: RelicWhyTreeSupplementKind, index: number): void => {
    if (!onChange) return;
    applyUpdate(removeRelicWhyTreeSupplement(content, path, kind, index));
    selectParentMainNode(path);
  };
  const deleteSelection = (): void => {
    if (selection.kind === "phenomenon") return;
    if (selection.kind === "why") {
      removeMainWhy(selection.path);
      return;
    }

    if ("index" in selection) {
      removeSupplement(selection.path, selection.kind, selection.index);
    }
  };
  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (event.target instanceof HTMLInputElement) return;
    if (selection.kind === "phenomenon") return;

    event.preventDefault();
    deleteSelection();
  };
  const renderWhyTreeBranch = (item: WhyTreeChainItem): ReactElement => {
    const isSelected = isSameWhyTreeSelection(selection, { kind: item.role, path: item.path });

    return (
      <div className="why-tree-branch" key={item.path.join(".") || "phenomenon"}>
        <div className="why-tree-row">
          <SupplementColumn
            kind="fact"
            node={item.node}
            onChange={changeSupplement}
            onRemove={removeSupplement}
            onSelect={selectSupplement}
            path={item.path}
            selected={selection}
          />
          <div className="why-tree-main-column">
            <div
              className={[
                "why-tree-node-shell",
                isSelected ? "why-tree-node-shell--menu-open" : ""
              ].filter(Boolean).join(" ")}
            >
              <div
                className={[
                  "why-tree-main-node",
                  `why-tree-main-node--${item.role}`,
                  isSelected ? "why-tree-item--selected" : ""
                ].filter(Boolean).join(" ")}
                onClick={() => selectMainNode(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectMainNode(item);
                  }
                }}
                role="treeitem"
                tabIndex={0}
              >
                <span className="why-tree-role-label">{t(whyTreeRoleLabelKey(item.role))}</span>
                <input
                  aria-label={t(whyTreeTitleInputKey(item.role))}
                  onChange={(event) => changeMainTitle(item.path, event.currentTarget.value)}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectMainNode(item);
                  }}
                  onFocus={() => selectMainNode(item)}
                  value={item.node.title}
                />
                {item.role === "why" ? (
                  <button
                    aria-label={t("diagram.whyTree.delete")}
                    className="why-tree-delete-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeMainWhy(item.path);
                    }}
                    type="button"
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {isSelected ? (
                <WhyTreeNodeMenu
                  onAddAction={() => addSupplementFromPath(item.path, "action")}
                  onAddFact={() => addSupplementFromPath(item.path, "fact")}
                  onAddSolution={() => addSupplementFromPath(item.path, "solution")}
                  onAddWhy={() => {
                    if (!onChange) return;
                    applyUpdate(addRelicWhyTreeWhy(content, item.path));
                    setSelection({ kind: "why", path: [...item.path, item.node.whys.length] });
                  }}
                />
              ) : null}
            </div>
          </div>
          <div className="why-tree-support-column why-tree-support-column--right">
            <SupplementColumn
              kind="solution"
              node={item.node}
              onChange={changeSupplement}
              onRemove={removeSupplement}
              onSelect={selectSupplement}
              path={item.path}
              selected={selection}
            />
            <SupplementColumn
              kind="action"
              node={item.node}
              onChange={changeSupplement}
              onRemove={removeSupplement}
              onSelect={selectSupplement}
              path={item.path}
              selected={selection}
            />
          </div>
        </div>
        {item.node.whys.length > 0 ? (
          <div className="why-tree-child-group">
            <div aria-hidden="true" className="why-tree-connector" />
            <div className="why-tree-children">
              {item.node.whys.map((why, index) => renderWhyTreeBranch({
                node: why,
                path: [...item.path, index],
                role: "why"
              }))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div aria-label={fileName} className="why-tree-editor" onKeyDown={handleEditorKeyDown} role="tree">
      <div className="why-tree-content">
        {renderWhyTreeBranch({ node: tree.phenomenon, path: [], role: "phenomenon" })}
      </div>
    </div>
  );
}

function WhyTreeNodeMenu({
  onAddAction,
  onAddFact,
  onAddSolution,
  onAddWhy
}: {
  onAddAction: () => void;
  onAddFact: () => void;
  onAddSolution: () => void;
  onAddWhy: () => void;
}): ReactElement {
  const t = useT();

  return (
    <div className="why-tree-add-controls" aria-label={t("diagram.whyTree.addMenu")}>
      <button className="why-tree-add-control why-tree-add-control--fact" onClick={onAddFact} type="button">
        {t("diagram.whyTree.addFact")}
      </button>
      <button className="why-tree-add-control why-tree-add-control--why" onClick={onAddWhy} type="button">
        {t("diagram.whyTree.addWhy")}
      </button>
      <button className="why-tree-add-control why-tree-add-control--solution" onClick={onAddSolution} type="button">
        {t("diagram.whyTree.addSolution")}
      </button>
      <button className="why-tree-add-control why-tree-add-control--action" onClick={onAddAction} type="button">
        {t("diagram.whyTree.addAction")}
      </button>
    </div>
  );
}

function SupplementColumn({
  kind,
  node,
  onChange,
  onRemove,
  onSelect,
  path,
  selected
}: {
  kind: RelicWhyTreeSupplementKind;
  node: RelicWhyTreeNode;
  onChange: (path: number[], kind: RelicWhyTreeSupplementKind, index: number, event: ReactChangeEvent<HTMLInputElement>) => void;
  onRemove: (path: number[], kind: RelicWhyTreeSupplementKind, index: number) => void;
  onSelect: (path: number[], kind: RelicWhyTreeSupplementKind, index: number) => void;
  path: number[];
  selected: WhyTreeSelection;
}): ReactElement {
  const t = useT();
  const values = whyTreeSupplementValues(node, kind);

  return (
    <section className={`why-tree-support-column why-tree-support-column--${kind}`} aria-label={t(whyTreeSupplementSectionKey(kind))}>
      <span className="why-tree-support-heading">{t(whyTreeSupplementSectionKey(kind))}</span>
      {values.length === 0 ? (
        <span className="why-tree-support-empty">{t("diagram.whyTree.emptySupplement")}</span>
      ) : values.map((value, index) => {
        const isSelected = isSameWhyTreeSelection(selected, { index, kind, path });

        return (
          <div
            className={[
              "why-tree-support-item",
              `why-tree-support-item--${kind}`,
              isSelected ? "why-tree-item--selected" : ""
            ].filter(Boolean).join(" ")}
            key={`${kind}-${path.join(".")}-${index}`}
          >
            <input
              aria-label={t(whyTreeSupplementInputKey(kind))}
              onChange={(event) => onChange(path, kind, index, event)}
              onFocus={() => onSelect(path, kind, index)}
              value={value}
            />
            <button
              aria-label={t("diagram.whyTree.delete")}
              className="why-tree-delete-button"
              onClick={() => onRemove(path, kind, index)}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
    </section>
  );
}

export function diagramCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return t("diagram.invalidStatus");

  if (parsed.value.type === "why-tree") {
    const counts = countWhyTreeItems(parsed.value);
    return t("diagram.whyTreeStatus", counts);
  }

  return t("diagram.status", {
    lines: parsed.value.lines.length,
    nodes: parsed.value.nodes.length
  });
}

function buildDiagramCanvasLayout(diagram: RelicRelationshipDiagramDocument): DiagramCanvasLayout {
  if (diagram.nodes.length === 0) {
    return {
      height: minCanvasHeight,
      lines: [],
      nodes: [],
      originX: 0,
      originY: 0,
      width: minCanvasWidth
    };
  }

  const minX = Math.min(...diagram.nodes.map((node) => node.x));
  const minY = Math.min(...diagram.nodes.map((node) => node.y));
  const maxX = Math.max(...diagram.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...diagram.nodes.map((node) => node.y + node.height));
  const originX = minX - canvasPadding;
  const originY = minY - canvasPadding;
  const nodes = diagram.nodes.map((node) => ({
    node,
    x: node.x - originX,
    y: node.y - originY
  }));

  return {
    height: Math.max(minCanvasHeight, maxY - minY + canvasPadding * 2),
    lines: buildLineLayouts(diagram.lines, nodes),
    nodes,
    originX,
    originY,
    width: Math.max(minCanvasWidth, maxX - minX + canvasPadding * 2)
  };
}

function buildLineLayouts(
  lines: RelicDiagramLine[],
  nodes: DiagramCanvasNodeLayout[]
): DiagramCanvasLineLayout[] {
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

function buildWhyTreeChain(tree: RelicWhyTreeDocument): WhyTreeChainItem[] {
  const chain: WhyTreeChainItem[] = [{
    node: tree.phenomenon,
    path: [],
    role: "phenomenon"
  }];

  appendWhyTreeChildren(chain, tree.phenomenon.whys, []);

  return chain;
}

function appendWhyTreeChildren(
  chain: WhyTreeChainItem[],
  whys: RelicWhyTreeNode[],
  parentPath: number[]
): void {
  whys.forEach((why, index) => {
    const path = [...parentPath, index];
    chain.push({
      node: why,
      path,
      role: "why"
    });
    appendWhyTreeChildren(chain, why.whys, path);
  });
}

function countWhyTreeItems(tree: RelicWhyTreeDocument): {
  actions: number;
  facts: number;
  solutions: number;
  whys: number;
} {
  return buildWhyTreeChain(tree).reduce((counts, item) => ({
    actions: counts.actions + item.node.actions.length,
    facts: counts.facts + item.node.facts.length,
    solutions: counts.solutions + item.node.solutions.length,
    whys: counts.whys + (item.role === "why" ? 1 : 0)
  }), { actions: 0, facts: 0, solutions: 0, whys: 0 });
}

function whyTreeSupplementValues(node: RelicWhyTreeNode, kind: RelicWhyTreeSupplementKind): string[] {
  if (kind === "fact") return node.facts;
  if (kind === "solution") return node.solutions;
  return node.actions;
}

function whyTreeRoleLabelKey(role: "phenomenon" | "why"): "diagram.whyTree.phenomenon" | "diagram.whyTree.why" {
  return role === "phenomenon" ? "diagram.whyTree.phenomenon" : "diagram.whyTree.why";
}

function whyTreeTitleInputKey(role: "phenomenon" | "why"): "diagram.whyTree.phenomenonTitle" | "diagram.whyTree.whyTitle" {
  return role === "phenomenon" ? "diagram.whyTree.phenomenonTitle" : "diagram.whyTree.whyTitle";
}

function whyTreeSupplementSectionKey(
  kind: RelicWhyTreeSupplementKind
): "diagram.whyTree.facts" | "diagram.whyTree.solutions" | "diagram.whyTree.actions" {
  if (kind === "fact") return "diagram.whyTree.facts";
  if (kind === "solution") return "diagram.whyTree.solutions";
  return "diagram.whyTree.actions";
}

function whyTreeSupplementInputKey(
  kind: RelicWhyTreeSupplementKind
): "diagram.whyTree.factInput" | "diagram.whyTree.solutionInput" | "diagram.whyTree.actionInput" {
  if (kind === "fact") return "diagram.whyTree.factInput";
  if (kind === "solution") return "diagram.whyTree.solutionInput";
  return "diagram.whyTree.actionInput";
}

function isSameWhyTreeSelection(selection: WhyTreeSelection, target: WhyTreeSelection): boolean {
  if (selection.kind !== target.kind) return false;
  if (!samePath(selection.path, target.path)) return false;

  return ("index" in selection ? selection.index : undefined) === ("index" in target ? target.index : undefined);
}

function samePath(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
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
