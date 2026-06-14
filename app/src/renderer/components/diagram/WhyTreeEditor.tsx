import {
  type ChangeEvent as ReactChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  addRelicWhyTreeSupplement,
  addRelicWhyTreeWhy,
  parseRelicDiagramMarkdown,
  removeRelicWhyTreeSupplement,
  removeRelicWhyTreeWhy,
  updateRelicWhyTreeSupplement,
  updateRelicWhyTreeTitle,
  type RelicWhyTreeDocument,
  type RelicWhyTreeNode,
  type RelicWhyTreeSupplementKind
} from "../../../shared/diagramMarkdown";
import { useT } from "../../i18n";
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
  pointerId: number;
  scrollLeft: number;
  scrollTop: number;
  startClientX: number;
  startClientY: number;
}

type WhyTreeSelection =
  | { kind: "phenomenon" | "why"; path: number[] }
  | { index: number; kind: RelicWhyTreeSupplementKind; path: number[] };

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
  const [draftContent, setDraftContent] = useState(content);
  const [selection, setSelection] = useState<WhyTreeSelection>({ kind: "phenomenon", path: [] });
  const [connectorLayout, setConnectorLayout] = useState<WhyTreeConnectorLayout>({ height: 0, paths: [], width: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const displayedTree = useMemo(() => {
    const parsed = parseRelicDiagramMarkdown(draftContent);
    return parsed.ok && parsed.value.type === "why-tree" ? parsed.value : tree;
  }, [draftContent, tree]);

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
    const obstacles = getWhyTreeObstacleRects(contentRef.current, containerRect);
    const paths = buildWhyTreeConnectorPaths(displayedTree.phenomenon, [], nodeRefs.current, containerRect, obstacles);
    setConnectorLayout({
      height: containerRect.height,
      paths,
      width: containerRect.width
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
  }, [displayedTree]);

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
    event: ReactChangeEvent<HTMLInputElement>
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
  const startPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    if (!isWhyTreePanTarget(event.target, event.currentTarget)) return;

    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    panRef.current = {
      pointerId: event.pointerId,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
      startClientX: event.clientX,
      startClientY: event.clientY
    };
    setIsPanning(true);
  };
  const updatePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const activePan = panRef.current;
    if (!activePan || activePan.pointerId !== event.pointerId) return;

    event.preventDefault();
    event.currentTarget.scrollLeft = activePan.scrollLeft - (event.clientX - activePan.startClientX);
    event.currentTarget.scrollTop = activePan.scrollTop - (event.clientY - activePan.startClientY);
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
  const renderWhyTreeBranch = (item: WhyTreeChainItem): ReactElement => {
    const isSelected = isSameWhyTreeSelection(selection, { kind: item.role, path: item.path });
    const itemKey = whyTreePathKey(item.path);

    return (
      <div className="why-tree-branch" key={itemKey}>
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
                    applyUpdate(addRelicWhyTreeWhy(draftContentRef.current, item.path));
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
      role="tree"
    >
      {toolbar}
      <div className="why-tree-content" ref={contentRef}>
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
    <div className="why-tree-node-menu" aria-label={t("diagram.whyTree.addMenu")}>
      <button onClick={onAddWhy} type="button">{t("diagram.whyTree.addWhy")}</button>
      <button onClick={onAddFact} type="button">{t("diagram.whyTree.addFact")}</button>
      <button onClick={onAddSolution} type="button">{t("diagram.whyTree.addSolution")}</button>
      <button onClick={onAddAction} type="button">{t("diagram.whyTree.addAction")}</button>
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

function isWhyTreePanTarget(target: EventTarget, currentTarget: Element): boolean {
  if (!(target instanceof Element)) return target === currentTarget;
  if (target.closest("input, button")) return false;
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
