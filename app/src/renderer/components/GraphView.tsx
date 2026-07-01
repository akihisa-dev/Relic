import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";

import type { WorkspaceGraph, WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";

interface GraphViewProps {
  onOpenFile: (path: string) => void;
}

interface GraphOptions {
  centerStrength: number;
  hideUnresolved: boolean;
  lineSizeMultiplier: number;
  linkDistance: number;
  linkStrength: number;
  nodeSizeMultiplier: number;
  repelStrength: number;
  search: string;
  showArrows: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  showTags: boolean;
  textFadeMultiplier: number;
}

interface SimNode extends WorkspaceGraphNode {
  fx: number | null;
  fy: number | null;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

interface SimLink extends WorkspaceGraphLink {
  sourceNode: SimNode;
  targetNode: SimNode;
}

interface GraphColorGroup {
  color: string;
  id: string;
  query: string;
}

const defaultGraphOptions: GraphOptions = {
  centerStrength: 0.1,
  hideUnresolved: false,
  lineSizeMultiplier: 1,
  linkDistance: 250,
  linkStrength: 1,
  nodeSizeMultiplier: 1,
  repelStrength: 10,
  search: "",
  showArrows: false,
  showAttachments: false,
  showOrphans: true,
  showTags: false,
  textFadeMultiplier: 0
};

const graphCanvasSizeFallback = { height: 600, width: 900 };
const graphOptionsStorageKey = "relic.graphView.options.v1";
const graphControlsStorageKey = "relic.graphView.controlsOpen.v1";
const graphColorGroupsStorageKey = "relic.graphView.colorGroups.v1";

export function GraphView({ onOpenFile }: GraphViewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const nodesRef = useRef<Map<string, SimNode>>(new Map());
  const linksRef = useRef<SimLink[]>([]);
  const viewRef = useRef({ panX: 0, panY: 0, scale: 1 });
  const pointerRef = useRef<{
    dragNode: SimNode | null;
    lastX: number;
    lastY: number;
    moved: boolean;
    pointerId: number;
    type: "node" | "pan";
  } | null>(null);
  const latestOptionsRef = useRef(defaultGraphOptions);
  const colorGroupsRef = useRef<GraphColorGroup[]>([]);
  const openFileRef = useRef(onOpenFile);
  const [controlsOpen, setControlsOpen] = useState(loadGraphControlsOpen);
  const [graphState, setGraphState] = useState<{
    error: string | null;
    graph: WorkspaceGraph | null;
    loading: boolean;
  }>({ error: null, graph: null, loading: true });
  const [options, setOptions] = useState(loadGraphOptions);
  const [colorGroups, setColorGroups] = useState<GraphColorGroup[]>(loadGraphColorGroups);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  openFileRef.current = onOpenFile;
  latestOptionsRef.current = options;
  colorGroupsRef.current = colorGroups;

  useEffect(() => {
    let active = true;
    setGraphState((current) => ({ ...current, error: null, loading: true }));

    if (!window.relic) {
      setGraphState({ error: "グラフを読み込めませんでした。", graph: null, loading: false });
      return () => {
        active = false;
      };
    }

    void window.relic.getWorkspaceGraph().then((result) => {
      if (!active) return;

      if (result.ok) {
        setGraphState({ error: null, graph: result.value, loading: false });
        return;
      }

      setGraphState({ error: result.error.message, graph: null, loading: false });
    }).catch(() => {
      if (!active) return;
      setGraphState({ error: "グラフを読み込めませんでした。", graph: null, loading: false });
    });

    return () => {
      active = false;
    };
  }, []);

  const filteredGraph = useMemo(() => {
    const graph = graphState.graph ?? { links: [], nodes: [] };
    const search = options.search.trim().toLocaleLowerCase();
    const linkedIds = new Set<string>();

    for (const link of graph.links) {
      linkedIds.add(link.source);
      linkedIds.add(link.target);
    }

    const nodeIds = new Set(
      graph.nodes
        .filter((node) => {
          if (!options.showTags && node.type === "tag") return false;
          if (!options.showAttachments && node.type === "attachment") return false;
          if (options.hideUnresolved && node.type === "unresolved") return false;
          if (!options.showOrphans && !linkedIds.has(node.id)) return false;
          if (!search) return true;

          return `${node.label}\n${node.path ?? ""}\n${node.id}`.toLocaleLowerCase().includes(search);
        })
        .map((node) => node.id)
    );
    const links = graph.links.filter((link) =>
      nodeIds.has(link.source) &&
      nodeIds.has(link.target) &&
      (options.showTags || link.type !== "tag")
    );
    const connectedIds = new Set<string>();
    for (const link of links) {
      connectedIds.add(link.source);
      connectedIds.add(link.target);
    }

    return {
      links,
      nodes: graph.nodes.filter((node) =>
        nodeIds.has(node.id) &&
        (options.showOrphans || connectedIds.has(node.id))
      )
    };
  }, [graphState.graph, options.hideUnresolved, options.search, options.showAttachments, options.showOrphans, options.showTags]);

  useEffect(() => {
    saveJson(graphOptionsStorageKey, options);
  }, [options]);

  useEffect(() => {
    saveJson(graphColorGroupsStorageKey, colorGroups);
  }, [colorGroups]);

  useEffect(() => {
    saveJson(graphControlsStorageKey, controlsOpen);
  }, [controlsOpen]);

  useEffect(() => {
    syncSimulation(filteredGraph, nodesRef.current, linksRef);
  }, [filteredGraph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const cssWidth = rect.width || graphCanvasSizeFallback.width;
    const cssHeight = rect.height || graphCanvasSizeFallback.height;
    if (canvas.width !== Math.floor(cssWidth * pixelRatio) || canvas.height !== Math.floor(cssHeight * pixelRatio)) {
      canvas.width = Math.floor(cssWidth * pixelRatio);
      canvas.height = Math.floor(cssHeight * pixelRatio);
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    stepSimulation(nodesRef.current, linksRef.current, latestOptionsRef.current, cssWidth, cssHeight);
    drawGraph(
      context,
      [...nodesRef.current.values()],
      linksRef.current,
      viewRef.current,
      latestOptionsRef.current,
      colorGroupsRef.current,
      hoveredNodeId,
      cssWidth,
      cssHeight
    );

    frameRef.current = requestGraphFrame(draw);
  }, [hoveredNodeId]);

  useEffect(() => {
    frameRef.current = requestGraphFrame(draw);

    return () => {
      if (frameRef.current !== null) cancelGraphFrame(frameRef.current);
    };
  }, [draw]);

  const nodeAtPoint = useCallback((clientX: number, clientY: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const point = screenToWorld(
      clientX - rect.left,
      clientY - rect.top,
      rect.width || graphCanvasSizeFallback.width,
      rect.height || graphCanvasSizeFallback.height,
      viewRef.current
    );
    const nodes = [...nodesRef.current.values()].toReversed();

    for (const node of nodes) {
      if (distance(point.x, point.y, node.x, node.y) <= nodeRadius(node, latestOptionsRef.current) + 4) {
        return node;
      }
    }

    return null;
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const node = nodeAtPoint(event.clientX, event.clientY);
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);

    if (node) {
      node.fx = node.x;
      node.fy = node.y;
      pointerRef.current = {
        dragNode: node,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        pointerId: event.pointerId,
        type: "node"
      };
      return;
    }

    pointerRef.current = {
      dragNode: null,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
      type: "pan"
    };
  }, [nodeAtPoint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) {
      const node = nodeAtPoint(event.clientX, event.clientY);
      setHoveredNodeId(node?.id ?? null);
      return;
    }

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved ||= Math.abs(dx) + Math.abs(dy) > 2;

    if (pointer.dragNode) {
      pointer.dragNode.fx = (pointer.dragNode.fx ?? pointer.dragNode.x) + dx / viewRef.current.scale;
      pointer.dragNode.fy = (pointer.dragNode.fy ?? pointer.dragNode.y) + dy / viewRef.current.scale;
      pointer.dragNode.x = pointer.dragNode.fx;
      pointer.dragNode.y = pointer.dragNode.fy;
      return;
    }

    viewRef.current.panX += dx;
    viewRef.current.panY += dy;
  }, [nodeAtPoint]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;

    event.currentTarget.releasePointerCapture(pointer.pointerId);
    if (pointer.dragNode) {
      pointer.dragNode.fx = null;
      pointer.dragNode.fy = null;
      if (!pointer.moved && pointer.dragNode.path) {
        openFileRef.current(pointer.dragNode.path);
      }
    }

    pointerRef.current = null;
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const before = screenToWorld(
      event.clientX - rect.left,
      event.clientY - rect.top,
      rect.width || graphCanvasSizeFallback.width,
      rect.height || graphCanvasSizeFallback.height,
      viewRef.current
    );
    const delta = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
    const nextScale = clamp(viewRef.current.scale * Math.pow(1.5, -delta / 120), 0.15, 5);

    viewRef.current.scale = nextScale;
    viewRef.current.panX = event.clientX - rect.left - before.x * nextScale;
    viewRef.current.panY = event.clientY - rect.top - before.y * nextScale;
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = { panX: 0, panY: 0, scale: 1 };
    setOptions(defaultGraphOptions);
    setColorGroups([]);
  }, []);

  return (
    <div className="graph-view-shell">
      <canvas
        aria-label="グラフビュー"
        className="graph-view-canvas"
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setHoveredNodeId(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={canvasRef}
      />
      {graphState.loading ? <div className="graph-view-status">読み込んでいます...</div> : null}
      {graphState.error ? (
        <div className="graph-view-status graph-view-status--error">{graphState.error}</div>
      ) : null}
      <GraphControls
        colorGroups={colorGroups}
        controlsOpen={controlsOpen}
        nodeCount={filteredGraph.nodes.length}
        onAddColorGroup={() => setColorGroups((current) => [
          ...current,
          { color: nextGroupColor(current.length), id: `group-${Date.now()}-${current.length}`, query: "" }
        ])}
        onColorGroupChange={(groupId, patch) => setColorGroups((current) =>
          current.map((group) => group.id === groupId ? { ...group, ...patch } : group)
        )}
        onColorGroupDelete={(groupId) => setColorGroups((current) => current.filter((group) => group.id !== groupId))}
        onOptionsChange={(patch) => setOptions((current) => ({ ...current, ...patch }))}
        onReset={resetView}
        onToggleControls={() => setControlsOpen((current) => !current)}
        options={options}
      />
    </div>
  );
}

function GraphControls({
  colorGroups,
  controlsOpen,
  nodeCount,
  onAddColorGroup,
  onColorGroupChange,
  onColorGroupDelete,
  onOptionsChange,
  onReset,
  onToggleControls,
  options
}: {
  colorGroups: GraphColorGroup[];
  controlsOpen: boolean;
  nodeCount: number;
  onAddColorGroup: () => void;
  onColorGroupChange: (groupId: string, patch: Partial<GraphColorGroup>) => void;
  onColorGroupDelete: (groupId: string) => void;
  onOptionsChange: (patch: Partial<GraphOptions>) => void;
  onReset: () => void;
  onToggleControls: () => void;
  options: GraphOptions;
}): ReactElement {
  return (
    <aside className={`graph-controls${controlsOpen ? "" : " is-close"}`} data-ignore-swipe="true">
      <button
        aria-label={controlsOpen ? "グラフ設定を閉じる" : "グラフ設定を開く"}
        className={`graph-controls-button ${controlsOpen ? "mod-close" : "mod-open"}`}
        onClick={onToggleControls}
        title={controlsOpen ? "閉じる" : "開く"}
        type="button"
      >
        {controlsOpen ? "x" : "⚙"}
      </button>
      <button
        aria-label="グラフ設定をリセット"
        className="graph-controls-button mod-reset"
        onClick={onReset}
        title="初期設定に戻す"
        type="button"
      >
        ↺
      </button>
      <GraphControlSection title="Filters">
        <input
          aria-label="ノードをフィルタ"
          className="graph-search-input"
          onChange={(event) => onOptionsChange({ search: event.target.value })}
          placeholder="Search nodes..."
          type="search"
          value={options.search}
        />
        <GraphToggle label="Tags" onChange={(showTags) => onOptionsChange({ showTags })} value={options.showTags} />
        <GraphToggle
          label="Attachments"
          onChange={(showAttachments) => onOptionsChange({ showAttachments })}
          value={options.showAttachments}
        />
        <GraphToggle
          label="Existing files only"
          onChange={(hideUnresolved) => onOptionsChange({ hideUnresolved })}
          value={options.hideUnresolved}
        />
        <GraphToggle label="Orphans" onChange={(showOrphans) => onOptionsChange({ showOrphans })} value={options.showOrphans} />
      </GraphControlSection>
      <GraphControlSection title="Groups">
        <div className="graph-color-groups-container">
          {colorGroups.map((group) => (
            <div className="graph-color-group" key={group.id}>
              <input
                aria-label="グループ検索"
                onChange={(event) => onColorGroupChange(group.id, { query: event.target.value })}
                placeholder="Enter query..."
                type="text"
                value={group.query}
              />
              <input
                aria-label="グループ色"
                onChange={(event: ChangeEvent<HTMLInputElement>) => onColorGroupChange(group.id, { color: event.target.value })}
                type="color"
                value={group.color}
              />
              <button aria-label="グループを削除" onClick={() => onColorGroupDelete(group.id)} type="button">x</button>
            </div>
          ))}
        </div>
        <button className="graph-cta-button" onClick={onAddColorGroup} type="button">New group</button>
      </GraphControlSection>
      <GraphControlSection title="Display">
        <GraphToggle label="Arrows" onChange={(showArrows) => onOptionsChange({ showArrows })} value={options.showArrows} />
        <GraphSlider label="Text fade threshold" max={3} min={-3} onChange={(textFadeMultiplier) => onOptionsChange({ textFadeMultiplier })} step={0.1} value={options.textFadeMultiplier} />
        <GraphSlider label="Node size" max={5} min={0.1} onChange={(nodeSizeMultiplier) => onOptionsChange({ nodeSizeMultiplier })} step={0.1} value={options.nodeSizeMultiplier} />
        <GraphSlider label="Link thickness" max={5} min={0.1} onChange={(lineSizeMultiplier) => onOptionsChange({ lineSizeMultiplier })} step={0.1} value={options.lineSizeMultiplier} />
      </GraphControlSection>
      <GraphControlSection title="Forces">
        <GraphSlider label="Center force" max={1} min={0} onChange={(centerStrength) => onOptionsChange({ centerStrength })} step={0.01} value={options.centerStrength} />
        <GraphSlider label="Repel force" max={20} min={0} onChange={(repelStrength) => onOptionsChange({ repelStrength })} step={0.1} value={options.repelStrength} />
        <GraphSlider label="Link force" max={1} min={0} onChange={(linkStrength) => onOptionsChange({ linkStrength })} step={0.01} value={options.linkStrength} />
        <GraphSlider label="Link distance" max={500} min={30} onChange={(linkDistance) => onOptionsChange({ linkDistance })} step={1} value={options.linkDistance} />
      </GraphControlSection>
      <div className="graph-control-count">{nodeCount} nodes</div>
    </aside>
  );
}

function GraphControlSection({ children, title }: { children: React.ReactNode; title: string }): ReactElement {
  return (
    <section className="graph-control-section">
      <div className="graph-control-section-header">{title}</div>
      <div className="graph-control-section-children">{children}</div>
    </section>
  );
}

function GraphToggle({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: boolean }): ReactElement {
  return (
    <label className="graph-setting-item graph-setting-item--toggle">
      <span>{label}</span>
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function GraphSlider({
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}): ReactElement {
  return (
    <label className="graph-setting-item graph-setting-item--slider">
      <span>{label}</span>
      <input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    </label>
  );
}

function syncSimulation(
  graph: WorkspaceGraph,
  nodes: Map<string, SimNode>,
  linksRef: React.MutableRefObject<SimLink[]>
): void {
  const nextIds = new Set(graph.nodes.map((node) => node.id));

  for (const id of nodes.keys()) {
    if (!nextIds.has(id)) nodes.delete(id);
  }

  graph.nodes.forEach((node, index) => {
    if (nodes.has(node.id)) {
      Object.assign(nodes.get(node.id)!, node);
      return;
    }

    const angle = index * 2.399963229728653;
    const radius = 80 + 9 * Math.sqrt(index);
    nodes.set(node.id, {
      ...node,
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
  });

  linksRef.current = graph.links.flatMap((link) => {
    const sourceNode = nodes.get(link.source);
    const targetNode = nodes.get(link.target);
    return sourceNode && targetNode ? [{ ...link, sourceNode, targetNode }] : [];
  });
}

function stepSimulation(
  nodes: Map<string, SimNode>,
  links: SimLink[],
  options: GraphOptions,
  width: number,
  height: number
): void {
  const nodeList = [...nodes.values()];
  const centerX = width / 2;
  const centerY = height / 2;

  for (const node of nodeList) {
    node.vx += (-node.x) * options.centerStrength * 0.002;
    node.vy += (-node.y) * options.centerStrength * 0.002;
  }

  for (const link of links) {
    const source = link.sourceNode;
    const target = link.targetNode;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const strength = (length - options.linkDistance) / length * options.linkStrength * 0.002;
    const fx = dx * strength;
    const fy = dy * strength;
    source.vx += fx;
    source.vy += fy;
    target.vx -= fx;
    target.vy -= fy;
  }

  for (let i = 0; i < nodeList.length; i += 1) {
    for (let j = i + 1; j < nodeList.length; j += 1) {
      const a = nodeList[i];
      const b = nodeList[j];
      const dx = b.x - a.x || 0.01;
      const dy = b.y - a.y || 0.01;
      const distanceSq = Math.max(64, dx * dx + dy * dy);
      const repel = Math.pow(options.repelStrength, 3);
      const force = Math.min(2.4, repel * 0.08 / distanceSq);
      const length = Math.sqrt(distanceSq);
      const fx = dx / length * force;
      const fy = dy / length * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  for (const node of nodeList) {
    if (node.fx !== null && node.fy !== null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.vx *= 0.88;
    node.vy *= 0.88;
    node.x += node.vx;
    node.y += node.vy;
    node.x = clamp(node.x, -centerX * 4, centerX * 4);
    node.y = clamp(node.y, -centerY * 4, centerY * 4);
  }
}

function drawGraph(
  context: CanvasRenderingContext2D,
  nodes: SimNode[],
  links: SimLink[],
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  colorGroups: GraphColorGroup[],
  hoveredNodeId: string | null,
  width: number,
  height: number
): void {
  context.save();
  context.translate(view.panX + width / 2, view.panY + height / 2);
  context.scale(view.scale, view.scale);

  const focused = hoveredNodeId ? nodes.find((node) => node.id === hoveredNodeId) ?? null : null;
  const neighbors = new Set<string>();
  if (focused) {
    for (const link of links) {
      if (link.source === focused.id) neighbors.add(link.target);
      if (link.target === focused.id) neighbors.add(link.source);
    }
  }

  for (const link of links) {
    const active = !focused || link.source === focused.id || link.target === focused.id;
    context.globalAlpha = active ? 0.65 : 0.12;
    context.strokeStyle = active ? cssVar("--color-border-strong", "#9a9a9a") : cssVar("--color-border", "#dedede");
    context.lineWidth = Math.max(0.4, options.lineSizeMultiplier * Math.sqrt(link.count));
    context.beginPath();
    context.moveTo(link.sourceNode.x, link.sourceNode.y);
    context.lineTo(link.targetNode.x, link.targetNode.y);
    context.stroke();

    if (options.showArrows) {
      drawArrow(context, link.sourceNode, link.targetNode, options);
    }
  }

  context.globalAlpha = 1;
  for (const node of nodes) {
    const active = !focused || node.id === focused.id || neighbors.has(node.id);
    const radius = nodeRadius(node, options);
    const color = nodeColor(node, colorGroups, node.id === focused?.id);
    context.globalAlpha = active ? 1 : 0.22;
    context.fillStyle = color;
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fill();

    if (node.id === focused?.id) {
      context.strokeStyle = cssVar("--color-primary", "#2f66b1");
      context.lineWidth = 2 / view.scale;
      context.beginPath();
      context.arc(node.x, node.y, radius + 5 / view.scale, 0, Math.PI * 2);
      context.stroke();
    }

    const labelAlpha = labelOpacity(view.scale, options.textFadeMultiplier);
    if (labelAlpha > 0.02) {
      context.globalAlpha = (active ? 1 : 0.2) * labelAlpha;
      context.fillStyle = cssVar("--color-text", "#1e1e1e");
      context.font = `${Math.max(10, 13 / view.scale)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(node.label, node.x, node.y + radius + 4 / view.scale, 240 / view.scale);
    }
  }
  context.restore();
}

function drawArrow(context: CanvasRenderingContext2D, source: SimNode, target: SimNode, options: GraphOptions): void {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = nodeRadius(target, options) + 3;
  const x = target.x - Math.cos(angle) * radius;
  const y = target.y - Math.sin(angle) * radius;
  const size = 6;

  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - Math.cos(angle - 0.45) * size, y - Math.sin(angle - 0.45) * size);
  context.lineTo(x - Math.cos(angle + 0.45) * size, y - Math.sin(angle + 0.45) * size);
  context.closePath();
  context.fillStyle = context.strokeStyle;
  context.fill();
}

function nodeRadius(node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount" | "type">, options: GraphOptions): number {
  const weight = 1 + Math.sqrt(node.backlinkCount + node.linkCount) * 0.55;
  const typeMultiplier = node.type === "tag" ? 0.85 : node.type === "attachment" ? 0.78 : node.type === "unresolved" ? 0.72 : 1;

  return clamp(4.5 * weight * typeMultiplier * options.nodeSizeMultiplier, 3, 24);
}

function nodeColor(node: WorkspaceGraphNode, groups: GraphColorGroup[], focused: boolean): string {
  if (focused) return cssVar("--color-primary", "#2f66b1");

  const searchText = `${node.label}\n${node.path ?? ""}\n${node.id}`.toLocaleLowerCase();
  const group = groups.find((candidate) => candidate.query.trim() && searchText.includes(candidate.query.trim().toLocaleLowerCase()));
  if (group) return group.color;

  if (node.type === "tag") return cssVar("--color-accent", "#3c8f6d");
  if (node.type === "attachment") return cssVar("--color-primary-muted", "#6f8fc8");
  if (node.type === "unresolved") return cssVar("--color-text-muted", "#9a9a9a");

  return cssVar("--color-text-secondary", "#5f646d");
}

function labelOpacity(scale: number, textFadeMultiplier: number): number {
  return clamp((scale - 0.18 + textFadeMultiplier * 0.08) / 0.55, 0, 1);
}

function screenToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  view: { panX: number; panY: number; scale: number }
): { x: number; y: number } {
  return {
    x: (x - view.panX - width / 2) / view.scale,
    y: (y - view.panY - height / 2) / view.scale
  };
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function nextGroupColor(index: number): string {
  const colors = ["#2f66b1", "#3c8f6d", "#b06a2c", "#8d66d9", "#b74b65", "#6c7786"];

  return colors[index % colors.length];
}

function loadGraphOptions(): GraphOptions {
  const stored = loadJson<Partial<GraphOptions>>(graphOptionsStorageKey);

  return sanitizeGraphOptions(stored);
}

function sanitizeGraphOptions(value: Partial<GraphOptions> | null): GraphOptions {
  if (!value || typeof value !== "object") return defaultGraphOptions;

  return {
    centerStrength: safeNumber(value.centerStrength, defaultGraphOptions.centerStrength, 0, 1),
    hideUnresolved: typeof value.hideUnresolved === "boolean" ? value.hideUnresolved : defaultGraphOptions.hideUnresolved,
    lineSizeMultiplier: safeNumber(value.lineSizeMultiplier, defaultGraphOptions.lineSizeMultiplier, 0.1, 5),
    linkDistance: safeNumber(value.linkDistance, defaultGraphOptions.linkDistance, 30, 500),
    linkStrength: safeNumber(value.linkStrength, defaultGraphOptions.linkStrength, 0, 1),
    nodeSizeMultiplier: safeNumber(value.nodeSizeMultiplier, defaultGraphOptions.nodeSizeMultiplier, 0.1, 5),
    repelStrength: safeNumber(value.repelStrength, defaultGraphOptions.repelStrength, 0, 20),
    search: typeof value.search === "string" ? value.search.slice(0, 200) : defaultGraphOptions.search,
    showArrows: typeof value.showArrows === "boolean" ? value.showArrows : defaultGraphOptions.showArrows,
    showAttachments: typeof value.showAttachments === "boolean" ? value.showAttachments : defaultGraphOptions.showAttachments,
    showOrphans: typeof value.showOrphans === "boolean" ? value.showOrphans : defaultGraphOptions.showOrphans,
    showTags: typeof value.showTags === "boolean" ? value.showTags : defaultGraphOptions.showTags,
    textFadeMultiplier: safeNumber(value.textFadeMultiplier, defaultGraphOptions.textFadeMultiplier, -3, 3)
  };
}

function loadGraphControlsOpen(): boolean {
  const stored = loadJson<boolean>(graphControlsStorageKey);

  return typeof stored === "boolean" ? stored : true;
}

function loadGraphColorGroups(): GraphColorGroup[] {
  const stored = loadJson<unknown>(graphColorGroupsStorageKey);
  if (!Array.isArray(stored)) return [];

  return stored.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const group = item as Partial<GraphColorGroup>;
    if (typeof group.query !== "string" || typeof group.color !== "string") return [];

    return [{
      color: /^#[0-9a-f]{6}$/i.test(group.color) ? group.color : nextGroupColor(index),
      id: typeof group.id === "string" ? group.id : `group-${index}`,
      query: group.query.slice(0, 200)
    }];
  }).slice(0, 12);
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 設定保存に失敗してもグラフ表示自体は継続する。
  }
}

function requestGraphFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 16);
}

function cancelGraphFrame(id: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
    return;
  }

  window.clearTimeout(id);
}
