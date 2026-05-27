import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactElement } from "react";

import {
  appendMermaidMarkdownBlock,
  buildCanvasMermaidSource,
  createEmptyCanvasDiagram,
  findMermaidMarkdownBlocks,
  nextCanvasNodeId,
  parseCanvasMermaid,
  replaceMermaidMarkdownBlock,
  type CanvasDiagram,
  type CanvasDirection,
  type CanvasEdge,
  type CanvasNode,
  type CanvasShape
} from "../canvasMermaid";
import { useT } from "../i18n";
import { useEditorStore, type FileTab, type PaneState, type Tab } from "../store/editorStore";

type CanvasMode = "select" | "connect";

interface DragState {
  id: string;
  nodeX: number;
  nodeY: number;
  startX: number;
  startY: number;
}

const nodeWidth = 128;
const nodeHeight = 58;

export function CanvasPanel(): ReactElement {
  const t = useT();
  const {
    focusedPane,
    leftPane,
    rightPane,
    tabs,
    updateTabContent
  } = useEditorStore();
  const targetTab = useMemo(
    () => latestFileTabForPane(focusedPane === "left" ? leftPane : rightPane, tabs),
    [focusedPane, leftPane, rightPane, tabs]
  );
  const blocks = useMemo(
    () => targetTab ? findMermaidMarkdownBlocks(targetTab.content) : [],
    [targetTab]
  );
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const activeBlock = selectedBlockIndex === null ? null : blocks[selectedBlockIndex] ?? null;
  const activeParseResult = useMemo(
    () => activeBlock ? parseCanvasMermaid(activeBlock.source) : null,
    [activeBlock]
  );
  const [diagram, setDiagram] = useState<CanvasDiagram | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [connectStartId, setConnectStartId] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>("select");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const lastWrittenSourceRef = useRef<string | null>(null);

  const isEditable = Boolean(targetTab && activeBlock && activeParseResult?.ok && diagram);
  const selectedNode = diagram?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = diagram?.edges.find((edge) => edgeKey(edge) === selectedEdgeKey) ?? null;
  const mermaidSource = diagram ? buildCanvasMermaidSource(diagram) : activeBlock?.source ?? "";

  useEffect(() => {
    if (blocks.length === 0) {
      setSelectedBlockIndex(null);
      return;
    }

    if (blocks.length === 1) {
      setSelectedBlockIndex(0);
      return;
    }

    setSelectedBlockIndex((current) => current !== null && current < blocks.length ? current : null);
  }, [blocks.length, targetTab?.id]);

  useEffect(() => {
    if (!activeBlock || !activeParseResult?.ok) {
      setDiagram(null);
      setSelectedNodeId(null);
      setSelectedEdgeKey(null);
      setConnectStartId(null);
      setMode("select");
      return;
    }

    if (diagram && activeBlock.source === lastWrittenSourceRef.current) return;

    setDiagram(activeParseResult.diagram);
    setSelectedNodeId(activeParseResult.diagram.nodes[0]?.id ?? null);
    setSelectedEdgeKey(null);
    setConnectStartId(null);
    setMode("select");
  }, [activeBlock, activeParseResult]);

  const commitDiagram = (nextDiagram: CanvasDiagram): void => {
    if (!targetTab || !activeBlock) return;

    const source = buildCanvasMermaidSource(nextDiagram);
    lastWrittenSourceRef.current = source;
    setDiagram(nextDiagram);
    updateTabContent(targetTab.id, replaceMermaidMarkdownBlock(targetTab.content, activeBlock, source));
  };

  const createMermaidCanvas = (): void => {
    if (!targetTab) return;

    const source = buildCanvasMermaidSource(createEmptyCanvasDiagram());
    lastWrittenSourceRef.current = source;
    updateTabContent(targetTab.id, appendMermaidMarkdownBlock(targetTab.content, source));
  };

  const addNode = (shape: CanvasShape): void => {
    if (!diagram || !isEditable) return;

    const id = nextCanvasNodeId(diagram.nodes);
    const index = diagram.nodes.length;
    const node: CanvasNode = {
      id,
      label: `Node ${index + 1}`,
      shape,
      x: 84 + (index % 4) * 42,
      y: 84 + index * 34
    };
    commitDiagram({ ...diagram, nodes: [...diagram.nodes, node] });
    setSelectedNodeId(id);
    setSelectedEdgeKey(null);
    setMode("select");
    setConnectStartId(null);
  };

  const updateSelectedNode = (patch: Partial<Pick<CanvasNode, "label" | "shape">>): void => {
    if (!diagram || !selectedNode || !isEditable) return;

    commitDiagram({
      ...diagram,
      nodes: diagram.nodes.map((node) => (
        node.id === selectedNode.id ? { ...node, ...patch } : node
      ))
    });
  };

  const deleteSelectedNode = (): void => {
    if (!diagram || !selectedNode || !isEditable) return;

    commitDiagram({
      ...diagram,
      edges: diagram.edges.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id),
      nodes: diagram.nodes.filter((node) => node.id !== selectedNode.id)
    });
    setSelectedNodeId(null);
    setSelectedEdgeKey(null);
    setConnectStartId(null);
  };

  const deleteSelectedEdge = (): void => {
    if (!diagram || !selectedEdge || !isEditable) return;

    commitDiagram({
      ...diagram,
      edges: diagram.edges.filter((edge) => edgeKey(edge) !== edgeKey(selectedEdge))
    });
    setSelectedEdgeKey(null);
  };

  const updateDirection = (direction: CanvasDirection): void => {
    if (!diagram || !isEditable) return;
    commitDiagram({ ...diagram, direction });
  };

  const handleNodeClick = (id: string): void => {
    if (!diagram || !isEditable) return;

    if (mode !== "connect") {
      setSelectedNodeId(id);
      setSelectedEdgeKey(null);
      return;
    }

    if (!connectStartId) {
      setConnectStartId(id);
      setSelectedNodeId(id);
      setSelectedEdgeKey(null);
      return;
    }

    if (connectStartId !== id) {
      const edge = { from: connectStartId, to: id };
      commitDiagram({
        ...diagram,
        edges: diagram.edges.some((current) => current.from === edge.from && current.to === edge.to)
          ? diagram.edges
          : [...diagram.edges, edge]
      });
    }
    setConnectStartId(null);
    setSelectedNodeId(id);
    setSelectedEdgeKey(null);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, node: CanvasNode): void => {
    if (mode !== "select" || event.button !== 0 || !isEditable) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(node.id);
    setSelectedEdgeKey(null);
    setDragState({
      id: node.id,
      nodeX: node.x,
      nodeY: node.y,
      startX: event.clientX,
      startY: event.clientY
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!dragState || !diagram) return;
    const nextX = Math.max(12, dragState.nodeX + event.clientX - dragState.startX);
    const nextY = Math.max(12, dragState.nodeY + event.clientY - dragState.startY);
    setDiagram({
      ...diagram,
      nodes: diagram.nodes.map((node) => (
        node.id === dragState.id ? { ...node, x: nextX, y: nextY } : node
      ))
    });
  };

  const stopDragging = (): void => {
    setDragState(null);
  };

  return (
    <div className="settings-page canvas-page">
      <header className="settings-page-header canvas-page-header">
        <p className="settings-page-kicker">{t("nav.canvas")}</p>
        <h2>{t("canvas.title")}</h2>
        {targetTab ? <p className="canvas-target">{targetTab.name}</p> : null}
      </header>

      {!targetTab ? (
        <div className="canvas-state-banner" role="status">{t("canvas.noMarkdownFile")}</div>
      ) : null}

      {targetTab && blocks.length === 0 ? (
        <div className="canvas-state-banner" role="status">
          <span>{t("canvas.noMermaidBlock")}</span>
          <button className="primary-button" onClick={createMermaidCanvas} type="button">
            {t("canvas.createMermaidCanvas")}
          </button>
        </div>
      ) : null}

      {targetTab && blocks.length > 1 ? (
        <label className="canvas-block-picker">
          <span>{t("canvas.block")}</span>
          <select
            aria-label={t("canvas.block")}
            onChange={(event) => setSelectedBlockIndex(event.target.value === "" ? null : Number(event.target.value))}
            value={selectedBlockIndex ?? ""}
          >
            <option value="">{t("canvas.selectBlock")}</option>
            {blocks.map((block) => (
              <option key={block.index} value={block.index}>
                {t("canvas.blockOption", { number: block.index + 1 })}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {activeBlock && activeParseResult && !activeParseResult.ok ? (
        <div className="canvas-state-banner" role="status">{t("canvas.unsupportedMermaid")}</div>
      ) : null}

      <div className="canvas-toolbar" role="toolbar">
        <button className="secondary-button" disabled={!isEditable} onClick={() => addNode("rectangle")} type="button">
          {t("canvas.addRectangle")}
        </button>
        <button className="secondary-button" disabled={!isEditable} onClick={() => addNode("diamond")} type="button">
          {t("canvas.addDiamond")}
        </button>
        <button className="secondary-button" disabled={!isEditable} onClick={() => addNode("circle")} type="button">
          {t("canvas.addCircle")}
        </button>
        <button
          className={`secondary-button${mode === "connect" ? " active" : ""}`}
          disabled={!isEditable}
          onClick={() => {
            setMode((current) => current === "connect" ? "select" : "connect");
            setConnectStartId(null);
          }}
          type="button"
        >
          {t("canvas.connect")}
        </button>
        <button className="secondary-button" disabled={!isEditable || !selectedNode} onClick={deleteSelectedNode} type="button">
          {t("canvas.deleteNode")}
        </button>
        <button className="secondary-button" disabled={!isEditable || !selectedEdge} onClick={deleteSelectedEdge} type="button">
          {t("canvas.deleteEdge")}
        </button>
      </div>

      <div className="canvas-workspace">
        <div
          className={`canvas-stage${!isEditable ? " canvas-stage--readonly" : ""}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedNodeId(null);
              setSelectedEdgeKey(null);
            }
          }}
        >
          <svg aria-hidden="true" className="canvas-edges">
            <defs>
              <marker id="canvas-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            {diagram?.edges.map((edge) => {
              const from = diagram.nodes.find((node) => node.id === edge.from);
              const to = diagram.nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;

              return (
                <line
                  className={edgeKey(edge) === selectedEdgeKey ? "canvas-edge--selected" : ""}
                  key={edgeKey(edge)}
                  markerEnd="url(#canvas-arrow)"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isEditable) return;
                    setSelectedEdgeKey(edgeKey(edge));
                    setSelectedNodeId(null);
                    setConnectStartId(null);
                  }}
                  x1={from.x + nodeWidth / 2}
                  x2={to.x + nodeWidth / 2}
                  y1={from.y + nodeHeight / 2}
                  y2={to.y + nodeHeight / 2}
                />
              );
            })}
          </svg>
          {diagram?.nodes.map((node) => (
            <button
              className={[
                "canvas-node",
                `canvas-node--${node.shape}`,
                selectedNodeId === node.id ? "canvas-node--selected" : "",
                connectStartId === node.id ? "canvas-node--connecting" : ""
              ].filter(Boolean).join(" ")}
              disabled={!isEditable}
              key={node.id}
              onClick={(event) => {
                event.stopPropagation();
                handleNodeClick(node.id);
              }}
              onPointerCancel={stopDragging}
              onPointerDown={(event) => handlePointerDown(event, node)}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              style={{ left: node.x, top: node.y }}
              type="button"
            >
              {node.label}
            </button>
          ))}
        </div>

        <aside className="canvas-inspector">
          <label className="canvas-field">
            <span>{t("canvas.direction")}</span>
            <select
              disabled={!isEditable}
              value={diagram?.direction ?? "TD"}
              onChange={(event) => updateDirection(event.target.value as CanvasDirection)}
            >
              <option value="TD">TD</option>
              <option value="LR">LR</option>
            </select>
          </label>
          {selectedNode ? (
            <>
              <label className="canvas-field">
                <span>{t("canvas.label")}</span>
                <input
                  disabled={!isEditable}
                  onChange={(event) => updateSelectedNode({ label: event.target.value })}
                  value={selectedNode.label}
                />
              </label>
              <label className="canvas-field">
                <span>{t("canvas.shape")}</span>
                <select
                  disabled={!isEditable}
                  onChange={(event) => updateSelectedNode({ shape: event.target.value as CanvasShape })}
                  value={selectedNode.shape}
                >
                  <option value="rectangle">{t("canvas.addRectangle")}</option>
                  <option value="diamond">{t("canvas.addDiamond")}</option>
                  <option value="circle">{t("canvas.addCircle")}</option>
                </select>
              </label>
            </>
          ) : selectedEdge ? (
            <div className="canvas-empty-selection">{`${selectedEdge.from} --> ${selectedEdge.to}`}</div>
          ) : (
            <div className="canvas-empty-selection">{t("canvas.emptySelection")}</div>
          )}
          <div className="canvas-source-block">
            <div className="canvas-source-heading">{t("canvas.source")}</div>
            <pre><code>{mermaidSource}</code></pre>
          </div>
        </aside>
      </div>
    </div>
  );
}

function latestFileTabForPane(paneState: PaneState, tabs: Record<string, Tab>): FileTab | null {
  const candidates = [...paneState.history].reverse();
  for (const tabId of candidates) {
    const tab = tabs[tabId];
    if (tab?.kind === "file") return tab;
  }

  for (const tabId of [...paneState.tabIds].reverse()) {
    const tab = tabs[tabId];
    if (tab?.kind === "file") return tab;
  }

  return null;
}

function edgeKey(edge: CanvasEdge): string {
  return `${edge.from}->${edge.to}`;
}
