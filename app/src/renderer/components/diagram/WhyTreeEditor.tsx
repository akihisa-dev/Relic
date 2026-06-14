import {
  type ChangeEvent as ReactChangeEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  addRelicWhyTreeSupplement,
  addRelicWhyTreeWhy,
  moveRelicWhyTreeSupplement,
  moveRelicWhyTreeWhy,
  parseRelicDiagramMarkdown,
  removeRelicWhyTreeSupplement,
  removeRelicWhyTreeWhy,
  updateRelicWhyTreeSupplement,
  updateRelicWhyTreeLabels,
  updateRelicWhyTreeTitle,
  type RelicWhyTreeDocument,
  type RelicWhyTreeLabels,
  type RelicWhyTreeMoveDirection,
  type RelicWhyTreeNode,
  type RelicWhyTreeSupplementKind
} from "../../../shared/diagramMarkdown";
import { useT } from "../../i18n";
import { clampZoom, screenToCanvasPoint, type ViewportState } from "./diagramViewport";
import { type DiagramCanvasProps } from "./diagramTypes";
import {
  buildWhyTreeConnectorPaths,
  getWhyTreeObstacleRects,
  whyTreePathKey,
  type WhyTreeConnectorLayout
} from "./whyTreeGeometry";

interface WhyTreeChainItem {
  node: RelicWhyTreeNode;
  path: number[];
  role: "phenomenon" | "why";
}

interface WhyTreePanState {
  originalPanX: number;
  originalPanY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

type WhyTreeSelection =
  | { kind: "phenomenon" | "why"; path: number[] }
  | { index: number; kind: RelicWhyTreeSupplementKind; path: number[] };

type WhyTreeDragState =
  | { kind: "why"; path: number[] }
  | { index: number; kind: RelicWhyTreeSupplementKind; path: number[] };

type WhyTreeLabelKey = keyof RelicWhyTreeLabels;

type WhyTreeUpdateResult = { ok: true; value: { content: string } } | { ok: false };

export function WhyTreeEditor({
  content,
  fileName,
  onChange,
  toolbar,
  tree
}: DiagramCanvasProps & { tree: RelicWhyTreeDocument }): ReactElement {
  const t = useT();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const draftContentRef = useRef(content);
  const panRef = useRef<WhyTreePanState | null>(null);
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(() => new Set());
  const [dragState, setDragState] = useState<WhyTreeDragState | null>(null);
  const [draftContent, setDraftContent] = useState(content);
  const [selection, setSelection] = useState<WhyTreeSelection | null>({ kind: "phenomenon", path: [] });
  const [connectorLayout, setConnectorLayout] = useState<WhyTreeConnectorLayout>({ height: 0, paths: [], width: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [labelPanelOpen, setLabelPanelOpen] = useState(true);
  const [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const displayedTree = useMemo(() => {
    const parsed = parseRelicDiagramMarkdown(draftContent);
    return parsed.ok && parsed.value.type === "why-tree" ? parsed.value : tree;
  }, [draftContent, tree]);
  const labels = displayedTree.labels;

  useEffect(() => {
    if (content === draftContentRef.current) return;
    draftContentRef.current = content;
    setDraftContent(content);
  }, [content]);

  const updateConnectorLayout = (): void => {
    if (!contentRef.current) {
      setConnectorLayout({ height: 0, paths: [], width: 0 });
      return;
    }

    const containerRect = contentRef.current.getBoundingClientRect();
    const obstacles = getWhyTreeObstacleRects(contentRef.current, containerRect, viewport.zoom);
    const paths = buildWhyTreeConnectorPaths(displayedTree.phenomenon, [], nodeRefs.current, containerRect, obstacles, collapsedPaths, viewport.zoom);
    setConnectorLayout({
      height: containerRect.height / viewport.zoom,
      paths,
      width: containerRect.width / viewport.zoom
    });
  };

  useLayoutEffect(() => {
    updateConnectorLayout();
    const container = contentRef.current;
    if (!container) return undefined;

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateConnectorLayout);
    resizeObserver?.observe(container);
    nodeRefs.current.forEach((node) => resizeObserver?.observe(node));
    window.addEventListener("resize", updateConnectorLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateConnectorLayout);
    };
  }, [collapsedPaths, displayedTree, viewport.zoom]);

  const applyUpdate = (updated: WhyTreeUpdateResult): void => {
    if (updated.ok) {
      draftContentRef.current = updated.value.content;
      setDraftContent(updated.value.content);
      onChange?.(updated.value.content);
    }
  };
  const selectMainNode = (item: WhyTreeChainItem): void => {
    setSelection({ kind: item.role, path: item.path });
  };
  const addSupplementFromPath = (path: number[], kind: RelicWhyTreeSupplementKind): void => {
    if (!onChange) return;
    applyUpdate(addRelicWhyTreeSupplement(draftContentRef.current, path, kind));
  };
  const changeMainTitle = (path: number[], value: string): void => {
    if (!onChange) return;
    applyUpdate(updateRelicWhyTreeTitle(draftContentRef.current, path, value));
  };
  const changeSupplement = (
    path: number[],
    kind: RelicWhyTreeSupplementKind,
    index: number,
    event: ReactChangeEvent<HTMLTextAreaElement>
  ): void => {
    if (!onChange) return;
    applyUpdate(updateRelicWhyTreeSupplement(draftContentRef.current, path, kind, index, event.currentTarget.value));
  };
  const selectSupplement = (path: number[], kind: RelicWhyTreeSupplementKind, index: number): void => {
    setSelection({ index, kind, path });
  };
  const selectParentMainNode = (path: number[]): void => {
    setSelection(path.length === 0 ? { kind: "phenomenon", path: [] } : { kind: "why", path });
  };
  const removeMainWhy = (path: number[]): void => {
    if (!onChange || path.length === 0) return;
    applyUpdate(removeRelicWhyTreeWhy(draftContentRef.current, path));
    setSelection({ kind: "phenomenon", path: [] });
  };
  const removeSupplement = (path: number[], kind: RelicWhyTreeSupplementKind, index: number): void => {
    if (!onChange) return;
    applyUpdate(removeRelicWhyTreeSupplement(draftContentRef.current, path, kind, index));
    selectParentMainNode(path);
  };
  const changeLabel = (key: WhyTreeLabelKey, value: string): void => {
    if (!onChange || value === displayedTree.labels[key]) return;
    applyUpdate(updateRelicWhyTreeLabels(draftContentRef.current, {
      ...displayedTree.labels,
      [key]: value
    }));
  };
  const moveMainWhyToIndex = (path: number[], targetIndex: number): void => {
    if (!onChange || path.length === 0) return;
    const sourceIndex = path[path.length - 1];
    if (sourceIndex === undefined || sourceIndex === targetIndex) return;

    const direction: RelicWhyTreeMoveDirection = sourceIndex > targetIndex ? "up" : "down";
    let currentContent = draftContentRef.current;
    let currentPath = [...path];
    let currentIndex = sourceIndex;

    while (currentIndex !== targetIndex) {
      const moved = moveRelicWhyTreeWhy(currentContent, currentPath, direction);
      if (!moved.ok) return;
      currentContent = moved.value.content;
      currentIndex += moveDirectionOffset(direction);
      currentPath = [...path.slice(0, -1), currentIndex];
    }

    applyUpdate({ ok: true, value: { content: currentContent } });
    setSelection({ kind: "why", path: currentPath });
  };
  const moveSupplementToIndex = (
    path: number[],
    kind: RelicWhyTreeSupplementKind,
    sourceIndex: number,
    targetIndex: number
  ): void => {
    if (!onChange || sourceIndex === targetIndex) return;

    const direction: RelicWhyTreeMoveDirection = sourceIndex > targetIndex ? "up" : "down";
    let currentContent = draftContentRef.current;
    let currentIndex = sourceIndex;

    while (currentIndex !== targetIndex) {
      const moved = moveRelicWhyTreeSupplement(currentContent, path, kind, currentIndex, direction);
      if (!moved.ok) return;
      currentContent = moved.value.content;
      currentIndex += moveDirectionOffset(direction);
    }

    applyUpdate({ ok: true, value: { content: currentContent } });
    setSelection({ index: currentIndex, kind, path });
  };
  const startDrag = (drag: WhyTreeDragState, event: ReactDragEvent<HTMLElement>): void => {
    setDragState(drag);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", drag.kind);
    }
  };
  const allowDrop = (event: ReactDragEvent<HTMLElement>): void => {
    if (!dragState) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  };
  const dropOnMainWhy = (path: number[], event: ReactDragEvent<HTMLElement>): void => {
    if (!dragState || dragState.kind !== "why") return;
    event.preventDefault();
    if (!samePath(dragState.path.slice(0, -1), path.slice(0, -1))) return;

    moveMainWhyToIndex(dragState.path, path[path.length - 1] ?? 0);
    setDragState(null);
  };
  const dropOnSupplement = (
    path: number[],
    kind: RelicWhyTreeSupplementKind,
    index: number,
    event: ReactDragEvent<HTMLElement>
  ): void => {
    if (!dragState || dragState.kind !== kind) return;
    event.preventDefault();
    if (!samePath(dragState.path, path)) return;

    moveSupplementToIndex(path, kind, dragState.index, index);
    setDragState(null);
  };
  const finishDrag = (): void => {
    setDragState(null);
  };
  const toggleCollapsedPath = (path: number[]): void => {
    const key = whyTreePathKey(path);
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  const addKeyboardWhy = (): void => {
    if (!onChange || !selection) return;
    if (selection.kind !== "phenomenon" && selection.kind !== "why") return;

    const parentPath = selection.kind === "phenomenon" ? [] : selection.path.slice(0, -1);
    const parent = whyTreeNodeAtPath(displayedTree.phenomenon, parentPath);
    if (!parent) return;

    const added = addRelicWhyTreeWhy(draftContentRef.current, parentPath);
    if (!added.ok) return;

    applyUpdate(added);
    setSelection({ kind: "why", path: [...parentPath, parent.whys.length] });
  };
  const deleteSelection = (): void => {
    if (!selection) return;
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
    if (isTextEditingTarget(event.target)) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setSelection(null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      addKeyboardWhy();
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (!selection) return;
    if (selection.kind === "phenomenon") return;

    event.preventDefault();
    deleteSelection();
  };
  const startPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    if (!isWhyTreePanTarget(event.target, event.currentTarget)) return;

    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    panRef.current = {
      originalPanX: viewport.panX,
      originalPanY: viewport.panY,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
    setIsPanning(true);
  };
  const updatePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const activePan = panRef.current;
    if (!activePan || activePan.pointerId !== event.pointerId) return;

    event.preventDefault();
    setViewport((current) => ({
      ...current,
      panX: activePan.originalPanX + event.clientX - activePan.startClientX,
      panY: activePan.originalPanY + event.clientY - activePan.startClientY
    }));
  };
  const finishPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const activePan = panRef.current;
    if (!activePan || activePan.pointerId !== event.pointerId) return;

    if (typeof event.currentTarget.hasPointerCapture === "function" && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panRef.current = null;
    setIsPanning(false);
  };
  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
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
  const renderWhyTreeBranch = (item: WhyTreeChainItem): ReactElement => {
    const isSelected = isSameWhyTreeSelection(selection, { kind: item.role, path: item.path });
    const itemKey = whyTreePathKey(item.path);
    const isCollapsed = collapsedPaths.has(itemKey);
    const hasChildWhys = item.node.whys.length > 0;

    return (
      <div className="why-tree-branch" key={itemKey}>
        <div className="why-tree-row">
          <SupplementColumn
            dragState={dragState}
            kind="fact"
            node={item.node}
            onAllowDrop={allowDrop}
            onChange={changeSupplement}
            onDragEnd={finishDrag}
            onDrop={dropOnSupplement}
            onRemove={removeSupplement}
            onSelect={selectSupplement}
            onStartDrag={startDrag}
            path={item.path}
            selected={selection}
            labels={labels}
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
                draggable={item.role === "why"}
                onDragEnd={finishDrag}
                onDragOver={allowDrop}
                onDragStart={(event) => {
                  if (item.role === "why") startDrag({ kind: "why", path: item.path }, event);
                }}
                onDrop={(event) => {
                  if (item.role === "why") dropOnMainWhy(item.path, event);
                }}
                onClick={() => selectMainNode(item)}
                onKeyDown={(event) => {
                  if (isTextEditingTarget(event.target)) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectMainNode(item);
                  }
                }}
                ref={(element) => {
                  if (element) {
                    nodeRefs.current.set(itemKey, element);
                  } else {
                    nodeRefs.current.delete(itemKey);
                  }
                }}
                role="treeitem"
                tabIndex={0}
              >
                <span className="why-tree-role-label">{item.role === "phenomenon" ? labels.root : labels.node}</span>
                <textarea
                  aria-label={item.role === "phenomenon" ? labels.root : labels.node}
                  onChange={(event) => changeMainTitle(item.path, event.currentTarget.value)}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectMainNode(item);
                  }}
                  onFocus={() => selectMainNode(item)}
                  rows={2}
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
                {hasChildWhys ? (
                  <button
                    aria-expanded={!isCollapsed}
                    aria-label={isCollapsed ? t("diagram.whyTree.expand") : t("diagram.whyTree.collapse")}
                    className="why-tree-collapse-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleCollapsedPath(item.path);
                    }}
                    type="button"
                  >
                    {isCollapsed ? "＋" : "−"}
                  </button>
                ) : null}
              </div>
              {isSelected ? (
                <WhyTreeNodeMenu
                  labels={labels}
                  onAddAction={() => addSupplementFromPath(item.path, "action")}
                  onAddFact={() => addSupplementFromPath(item.path, "fact")}
                  onAddSolution={() => addSupplementFromPath(item.path, "solution")}
                  onAddWhy={() => {
                    if (!onChange) return;
                    applyUpdate(addRelicWhyTreeWhy(draftContentRef.current, item.path));
                    setSelection({ kind: "why", path: [...item.path, item.node.whys.length] });
                  }}
                />
              ) : null}
            </div>
          </div>
          <SupplementColumn
            dragState={dragState}
            kind="solution"
            node={item.node}
            onAllowDrop={allowDrop}
            onChange={changeSupplement}
            onDragEnd={finishDrag}
            onDrop={dropOnSupplement}
            onRemove={removeSupplement}
            onSelect={selectSupplement}
            onStartDrag={startDrag}
            path={item.path}
            selected={selection}
            labels={labels}
          />
          <SupplementColumn
            dragState={dragState}
            kind="action"
            node={item.node}
            onAllowDrop={allowDrop}
            onChange={changeSupplement}
            onDragEnd={finishDrag}
            onDrop={dropOnSupplement}
            onRemove={removeSupplement}
            onSelect={selectSupplement}
            onStartDrag={startDrag}
            path={item.path}
            selected={selection}
            labels={labels}
          />
        </div>
        {hasChildWhys && !isCollapsed ? (
          <div className="why-tree-child-group">
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
    <div
      aria-label={fileName}
      className={`why-tree-editor${isPanning ? " why-tree-editor--panning" : ""}`}
      onKeyDown={handleEditorKeyDown}
      onPointerCancel={finishPan}
      onPointerDown={startPan}
      onPointerMove={updatePan}
      onPointerUp={finishPan}
      onWheel={handleWheel}
      role="tree"
    >
      {toolbar}
      {labelPanelOpen ? (
        <WhyTreeLabelPanel
          disabled={!onChange}
          labels={labels}
          onChange={changeLabel}
          onClose={() => setLabelPanelOpen(false)}
        />
      ) : (
        <button
          aria-label={t("diagram.whyTree.showLabelPanel")}
          className="why-tree-label-toggle"
          onClick={() => setLabelPanelOpen(true)}
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          type="button"
        >
          {t("diagram.whyTree.labelPanel")}
        </button>
      )}
      <div
        className="why-tree-content"
        ref={contentRef}
        style={{
          transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
          transformOrigin: "0 0"
        }}
      >
        {connectorLayout.paths.length > 0 ? (
          <svg
            aria-hidden="true"
            className="why-tree-lines"
            height={connectorLayout.height}
            viewBox={`0 0 ${connectorLayout.width} ${connectorLayout.height}`}
            width={connectorLayout.width}
          >
            {connectorLayout.paths.map((path) => (
              <path d={path.d} key={path.id} />
            ))}
          </svg>
        ) : null}
        {renderWhyTreeBranch({ node: displayedTree.phenomenon, path: [], role: "phenomenon" })}
      </div>
    </div>
  );
}

function WhyTreeNodeMenu({
  labels,
  onAddAction,
  onAddFact,
  onAddSolution,
  onAddWhy
}: {
  labels: RelicWhyTreeLabels;
  onAddAction: () => void;
  onAddFact: () => void;
  onAddSolution: () => void;
  onAddWhy: () => void;
}): ReactElement {
  const t = useT();

  return (
    <div className="why-tree-node-menu" aria-label={t("diagram.whyTree.addMenu")}>
      <button onClick={onAddWhy} type="button">+ {labels.node}</button>
      <button onClick={onAddFact} type="button">+ {labels.fact}</button>
      <button onClick={onAddSolution} type="button">+ {labels.solution}</button>
      <button onClick={onAddAction} type="button">+ {labels.action}</button>
    </div>
  );
}

function WhyTreeLabelPanel({
  disabled,
  labels,
  onChange,
  onClose
}: {
  disabled: boolean;
  labels: RelicWhyTreeLabels;
  onChange: (key: WhyTreeLabelKey, value: string) => void;
  onClose: () => void;
}): ReactElement {
  const t = useT();

  return (
    <div
      className="why-tree-label-panel"
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="why-tree-label-panel-header">
        <span className="why-tree-label-panel-title">{t("diagram.whyTree.labelPanel")}</span>
        <button
          aria-label={t("diagram.whyTree.closeLabelPanel")}
          className="why-tree-label-panel-close"
          onClick={onClose}
          type="button"
        >
          ×
        </button>
      </div>
      <div className="why-tree-label-fields">
        {whyTreeLabelFields.map((field) => (
          <label key={field.key}>
            <span>{t(field.labelKey)}</span>
            <input
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.currentTarget.value)}
              value={labels[field.key]}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function SupplementColumn({
  dragState,
  kind,
  labels,
  node,
  onAllowDrop,
  onChange,
  onDragEnd,
  onDrop,
  onRemove,
  onSelect,
  onStartDrag,
  path,
  selected
}: {
  dragState: WhyTreeDragState | null;
  kind: RelicWhyTreeSupplementKind;
  labels: RelicWhyTreeLabels;
  node: RelicWhyTreeNode;
  onAllowDrop: (event: ReactDragEvent<HTMLElement>) => void;
  onChange: (path: number[], kind: RelicWhyTreeSupplementKind, index: number, event: ReactChangeEvent<HTMLTextAreaElement>) => void;
  onDragEnd: () => void;
  onDrop: (path: number[], kind: RelicWhyTreeSupplementKind, index: number, event: ReactDragEvent<HTMLElement>) => void;
  onRemove: (path: number[], kind: RelicWhyTreeSupplementKind, index: number) => void;
  onSelect: (path: number[], kind: RelicWhyTreeSupplementKind, index: number) => void;
  onStartDrag: (drag: WhyTreeDragState, event: ReactDragEvent<HTMLElement>) => void;
  path: number[];
  selected: WhyTreeSelection | null;
}): ReactElement {
  const t = useT();
  const values = whyTreeSupplementValues(node, kind);
  const label = whyTreeSupplementLabel(labels, kind);

  return (
    <section className={`why-tree-support-column why-tree-support-column--${kind}`} aria-label={label}>
      <span className="why-tree-support-heading">{label}</span>
      {values.length === 0 ? (
        <span className="why-tree-support-empty">{t("diagram.whyTree.emptySupplement")}</span>
      ) : values.map((value, index) => {
        const isSelected = isSameWhyTreeSelection(selected, { index, kind, path });

        return (
          <div
            className={[
              "why-tree-support-item",
              `why-tree-support-item--${kind}`,
              dragState?.kind === kind && samePath(dragState.path, path) && dragState.index === index ? "why-tree-item--dragging" : "",
              isSelected ? "why-tree-item--selected" : ""
            ].filter(Boolean).join(" ")}
            draggable
            key={`${kind}-${path.join(".")}-${index}`}
            onDragEnd={onDragEnd}
            onDragOver={onAllowDrop}
            onDragStart={(event) => onStartDrag({ index, kind, path }, event)}
            onDrop={(event) => onDrop(path, kind, index, event)}
          >
            <textarea
              aria-label={label}
              onChange={(event) => onChange(path, kind, index, event)}
              onFocus={() => onSelect(path, kind, index)}
              rows={2}
              value={value}
            />
            <div className="why-tree-item-actions">
              <button
                aria-label={t("diagram.whyTree.delete")}
                className="why-tree-delete-button"
                onClick={() => onRemove(path, kind, index)}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
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

export function countWhyTreeItems(tree: RelicWhyTreeDocument): {
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

function isSameWhyTreeSelection(selection: WhyTreeSelection | null, target: WhyTreeSelection): boolean {
  if (!selection) return false;
  if (selection.kind !== target.kind) return false;
  if (!samePath(selection.path, target.path)) return false;

  return ("index" in selection ? selection.index : undefined) === ("index" in target ? target.index : undefined);
}

function isTextEditingTarget(target: EventTarget): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

function moveDirectionOffset(direction: RelicWhyTreeMoveDirection): -1 | 1 {
  return direction === "up" ? -1 : 1;
}

function whyTreeNodeAtPath(root: RelicWhyTreeNode, path: number[]): RelicWhyTreeNode | null {
  return path.reduce<RelicWhyTreeNode | null>((node, index) => node?.whys[index] ?? null, root);
}

function samePath(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function isWhyTreePanTarget(target: EventTarget, currentTarget: Element): boolean {
  if (!(target instanceof Element)) return target === currentTarget;
  if (target.closest("input, textarea, button")) return false;
  if (target.closest(".why-tree-label-panel")) return false;
  if (target.closest(".why-tree-main-node")) return false;
  if (target.closest(".why-tree-support-item")) return false;
  if (target.closest(".why-tree-node-menu")) return false;

  return target === currentTarget ||
    target.classList.contains("why-tree-editor") ||
    target.classList.contains("why-tree-content") ||
    target.classList.contains("why-tree-lines") ||
    target.classList.contains("why-tree-branch") ||
    target.classList.contains("why-tree-child-group") ||
    target.classList.contains("why-tree-children") ||
    target.classList.contains("why-tree-row") ||
    target.classList.contains("why-tree-main-column") ||
    target.classList.contains("why-tree-support-column") ||
    target.classList.contains("why-tree-support-empty");
}

const whyTreeLabelFields: {
  key: WhyTreeLabelKey;
  labelKey: "diagram.whyTree.labelField.action" | "diagram.whyTree.labelField.fact" | "diagram.whyTree.labelField.node" | "diagram.whyTree.labelField.root" | "diagram.whyTree.labelField.solution";
}[] = [
  { key: "root", labelKey: "diagram.whyTree.labelField.root" },
  { key: "node", labelKey: "diagram.whyTree.labelField.node" },
  { key: "fact", labelKey: "diagram.whyTree.labelField.fact" },
  { key: "solution", labelKey: "diagram.whyTree.labelField.solution" },
  { key: "action", labelKey: "diagram.whyTree.labelField.action" }
];

function whyTreeSupplementLabel(labels: RelicWhyTreeLabels, kind: RelicWhyTreeSupplementKind): string {
  if (kind === "fact") return labels.fact;
  if (kind === "solution") return labels.solution;
  return labels.action;
}
