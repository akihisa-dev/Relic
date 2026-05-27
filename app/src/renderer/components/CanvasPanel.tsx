import { useMemo, useState } from "react";
import type { PointerEvent, ReactElement } from "react";

import { useT } from "../i18n";

type CanvasShape = "rectangle" | "diamond" | "circle";
type CanvasMode = "select" | "connect";

interface CanvasNode {
  id: string;
  label: string;
  shape: CanvasShape;
  x: number;
  y: number;
}

interface CanvasEdge {
  from: string;
  to: string;
}

interface DragState {
  id: string;
  nodeX: number;
  nodeY: number;
  startX: number;
  startY: number;
}

const nodeWidth = 128;
const nodeHeight = 58;

const initialNodes: CanvasNode[] = [
  { id: "node1", label: "Node 1", shape: "rectangle", x: 88, y: 92 },
  { id: "node2", label: "Node 2", shape: "diamond", x: 322, y: 190 }
];

const initialEdges: CanvasEdge[] = [
  { from: "node1", to: "node2" }
];

export function CanvasPanel(): ReactElement {
  const t = useT();
  const [nodes, setNodes] = useState<CanvasNode[]>(initialNodes);
  const [edges, setEdges] = useState<CanvasEdge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("node1");
  const [connectStartId, setConnectStartId] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>("select");
  const [direction, setDirection] = useState<"TD" | "LR">("TD");
  const [dragState, setDragState] = useState<DragState | null>(null);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const mermaidSource = useMemo(
    () => buildMermaidSource(direction, nodes, edges),
    [direction, edges, nodes]
  );

  const addNode = (shape: CanvasShape): void => {
    const id = nextNodeId(nodes);
    const index = nodes.length + 1;
    const node: CanvasNode = {
      id,
      label: `Node ${index}`,
      shape,
      x: 100 + (index % 4) * 42,
      y: 96 + index * 34
    };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(id);
    setMode("select");
    setConnectStartId(null);
  };

  const updateSelectedNode = (patch: Partial<Pick<CanvasNode, "label" | "shape">>): void => {
    if (!selectedNode) return;
    setNodes((current) => current.map((node) => (
      node.id === selectedNode.id ? { ...node, ...patch } : node
    )));
  };

  const deleteSelectedNode = (): void => {
    if (!selectedNode) return;
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) => current.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id));
    setSelectedNodeId(null);
    setConnectStartId(null);
  };

  const resetCanvas = (): void => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId("node1");
    setConnectStartId(null);
    setMode("select");
    setDirection("TD");
  };

  const handleNodeClick = (id: string): void => {
    if (mode !== "connect") {
      setSelectedNodeId(id);
      return;
    }

    if (!connectStartId) {
      setConnectStartId(id);
      setSelectedNodeId(id);
      return;
    }

    if (connectStartId !== id) {
      setEdges((current) => (
        current.some((edge) => edge.from === connectStartId && edge.to === id)
          ? current
          : [...current, { from: connectStartId, to: id }]
      ));
    }
    setConnectStartId(null);
    setSelectedNodeId(id);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>, node: CanvasNode): void => {
    if (mode !== "select" || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedNodeId(node.id);
    setDragState({
      id: node.id,
      nodeX: node.x,
      nodeY: node.y,
      startX: event.clientX,
      startY: event.clientY
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!dragState) return;
    const nextX = Math.max(12, dragState.nodeX + event.clientX - dragState.startX);
    const nextY = Math.max(12, dragState.nodeY + event.clientY - dragState.startY);
    setNodes((current) => current.map((node) => (
      node.id === dragState.id ? { ...node, x: nextX, y: nextY } : node
    )));
  };

  const stopDragging = (): void => {
    setDragState(null);
  };

  return (
    <div className="settings-page canvas-page">
      <header className="settings-page-header canvas-page-header">
        <p className="settings-page-kicker">{t("nav.canvas")}</p>
        <h2>{t("canvas.title")}</h2>
      </header>

      <div className="canvas-toolbar" role="toolbar">
        <button className="secondary-button" onClick={() => addNode("rectangle")} type="button">
          {t("canvas.addRectangle")}
        </button>
        <button className="secondary-button" onClick={() => addNode("diamond")} type="button">
          {t("canvas.addDiamond")}
        </button>
        <button className="secondary-button" onClick={() => addNode("circle")} type="button">
          {t("canvas.addCircle")}
        </button>
        <button
          className={`secondary-button${mode === "connect" ? " active" : ""}`}
          onClick={() => {
            setMode((current) => current === "connect" ? "select" : "connect");
            setConnectStartId(null);
          }}
          type="button"
        >
          {t("canvas.connect")}
        </button>
        <button className="secondary-button" disabled={!selectedNode} onClick={deleteSelectedNode} type="button">
          {t("canvas.delete")}
        </button>
        <button className="secondary-button" onClick={resetCanvas} type="button">
          {t("canvas.reset")}
        </button>
      </div>

      <div className="canvas-workspace">
        <div
          className="canvas-stage"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedNodeId(null);
          }}
        >
          <svg aria-hidden="true" className="canvas-edges">
            <defs>
              <marker id="canvas-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>
            {edges.map((edge) => {
              const from = nodes.find((node) => node.id === edge.from);
              const to = nodes.find((node) => node.id === edge.to);
              if (!from || !to) return null;

              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  markerEnd="url(#canvas-arrow)"
                  x1={from.x + nodeWidth / 2}
                  x2={to.x + nodeWidth / 2}
                  y1={from.y + nodeHeight / 2}
                  y2={to.y + nodeHeight / 2}
                />
              );
            })}
          </svg>
          {nodes.map((node) => (
            <button
              className={[
                "canvas-node",
                `canvas-node--${node.shape}`,
                selectedNodeId === node.id ? "canvas-node--selected" : "",
                connectStartId === node.id ? "canvas-node--connecting" : ""
              ].filter(Boolean).join(" ")}
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
            <select value={direction} onChange={(event) => setDirection(event.target.value as "TD" | "LR")}>
              <option value="TD">TD</option>
              <option value="LR">LR</option>
            </select>
          </label>
          {selectedNode ? (
            <>
              <label className="canvas-field">
                <span>{t("canvas.label")}</span>
                <input
                  onChange={(event) => updateSelectedNode({ label: event.target.value })}
                  value={selectedNode.label}
                />
              </label>
              <label className="canvas-field">
                <span>{t("canvas.shape")}</span>
                <select
                  onChange={(event) => updateSelectedNode({ shape: event.target.value as CanvasShape })}
                  value={selectedNode.shape}
                >
                  <option value="rectangle">{t("canvas.addRectangle")}</option>
                  <option value="diamond">{t("canvas.addDiamond")}</option>
                  <option value="circle">{t("canvas.addCircle")}</option>
                </select>
              </label>
            </>
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

function nextNodeId(nodes: CanvasNode[]): string {
  const nextNumber = nodes.reduce((max, node) => {
    const match = /^node(\d+)$/.exec(node.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;

  return `node${nextNumber}`;
}

function buildMermaidSource(direction: "TD" | "LR", nodes: CanvasNode[], edges: CanvasEdge[]): string {
  return [
    `flowchart ${direction}`,
    ...nodes.map((node) => `  ${node.id}${shapeSource(node.shape, safeLabel(node.label))}`),
    ...edges.map((edge) => `  ${edge.from} --> ${edge.to}`)
  ].join("\n");
}

function shapeSource(shape: CanvasShape, label: string): string {
  if (shape === "diamond") return `{${label}}`;
  if (shape === "circle") return `((${label}))`;

  return `[${label}]`;
}

function safeLabel(label: string): string {
  return label.replace(/[()[\]{}|]/g, " ").replace(/\s+/g, " ").trim() || "Node";
}
