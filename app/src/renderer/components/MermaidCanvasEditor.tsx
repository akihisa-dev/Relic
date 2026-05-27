import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactElement } from "react";

import {
  buildCanvasMermaidSource,
  createEmptyCanvasDiagram,
  nextCanvasNodeId,
  parseCanvasMermaid,
  type CanvasDiagram,
  type CanvasDirection,
  type CanvasEdge,
  type CanvasNode,
  type CanvasShape
} from "../canvasMermaid";
import { useT } from "../i18n";

type CanvasMode = "select" | "connect";

interface DragState {
  id: string;
  nodeX: number;
  nodeY: number;
  startX: number;
  startY: number;
}

interface MermaidCanvasEditorProps {
  blockRange: {
    from: number;
    to: number;
  };
  filePath: string;
  onChange: (source: string) => void;
  source: string;
}

const nodeWidth = 128;
const nodeHeight = 58;

export function MermaidCanvasEditor({
  blockRange,
  filePath,
  onChange,
  source
}: MermaidCanvasEditorProps): ReactElement {
  const t = useT();
  const parseResult = useMemo(() => parseCanvasMermaid(source), [source]);
  const [diagram, setDiagram] = useState<CanvasDiagram | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [connectStartId, setConnectStartId] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>("select");
  const [dragState, setDragState] = useState<DragState | null>(null);
  const diagramRef = useRef<CanvasDiagram | null>(null);
  const lastWrittenSourceRef = useRef<string | null>(null);

  const isEmptyMermaid = !parseResult.ok && parseResult.reason === "empty";
  const isUnsupportedMermaid = !parseResult.ok && parseResult.reason !== "empty";
  const isEditable = Boolean(diagram && (parseResult.ok || isEmptyMermaid));
  const selectedNode = diagram?.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge = diagram?.edges.find((edge) => edgeKey(edge) === selectedEdgeKey) ?? null;
  const mermaidSource = diagram ? buildCanvasMermaidSource(diagram) : source;

  diagramRef.current = diagram;

  useEffect(() => {
    if (source === lastWrittenSourceRef.current) return;

    const nextDiagram = parseResult.ok ? parseResult.diagram : isEmptyMermaid ? createEmptyCanvasDiagram() : null;
    setDiagram(nextDiagram);
    setSelectedNodeId(nextDiagram?.nodes[0]?.id ?? null);
    setSelectedEdgeKey(null);
    setConnectStartId(null);
    setMode("select");
  }, [isEmptyMermaid, parseResult, source]);

  const commitDiagram = (nextDiagram: CanvasDiagram): void => {
    const nextSource = buildCanvasMermaidSource(nextDiagram);
    lastWrittenSourceRef.current = nextSource;
    setDiagram(nextDiagram);
    onChange(nextSource);
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
    if (dragState && diagramRef.current && isEditable) commitDiagram(diagramRef.current);
    setDragState(null);
  };

  return (
    <div className="canvas-editor">
      <div className="canvas-editor-context">
        <span>{filePath}</span>
        <span>{t("canvas.blockRange", { from: blockRange.from, to: blockRange.to })}</span>
        <strong>{t("canvas.savedToMarkdown")}</strong>
      </div>

      {isUnsupportedMermaid ? (
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

function edgeKey(edge: CanvasEdge): string {
  return `${edge.from}->${edge.to}`;
}
