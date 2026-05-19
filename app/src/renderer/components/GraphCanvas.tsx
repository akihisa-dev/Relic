import { useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  RefObject,
  WheelEvent
} from "react";
import type { Application, Container, FederatedPointerEvent, Graphics, Text } from "pixi.js";

import type { WorkspaceGraphEdge } from "../../shared/ipc";
import type { GraphPoint, GraphViewBox } from "../graphLayout";
import {
  buildGraphRenderState,
  defaultGraphRenderPalette,
  readGraphPalette,
  type GraphRenderEdge,
  type GraphRenderNode,
  type GraphRenderState
} from "../graphRenderModel";
import type { GraphGroup } from "../store/graphStore";
import type { GraphNodePointerEvent } from "../hooks/useGraphNodeInteractions";

export interface GraphViewBoxTransform {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

export interface GraphCanvasProps {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  groupByPath: Map<string, GraphGroup>;
  isMotionAfterglow: boolean;
  isPanning: boolean;
  labelOpacity: number;
  linkThickness: number;
  motionEpoch: number;
  motionPath: string | null;
  nodeSize: number;
  onGraphKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onGraphPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGraphPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGraphPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGraphPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onGraphWheel: (event: WheelEvent<HTMLDivElement>) => void;
  onNodeClick: (point: GraphPoint) => void;
  onNodeKeyDown: (event: KeyboardEvent<HTMLDivElement>, point: GraphPoint) => void;
  onNodePointerCancel: (event: GraphNodePointerEvent) => void;
  onNodePointerDown: (event: GraphNodePointerEvent, point: GraphPoint) => void;
  onNodePointerEnter: (path: string) => void;
  onNodePointerLeave: (path: string) => void;
  onNodePointerMove: (event: GraphNodePointerEvent) => void;
  onNodePointerUp: (event: GraphNodePointerEvent, point: GraphPoint) => void;
  points: GraphPoint[];
  relatedPaths: Set<string>;
  selectedPath: string | null;
  showArrows: boolean;
  showLabels: boolean;
  surfaceRef: RefObject<HTMLDivElement | null>;
  viewBox: GraphViewBox;
}

interface PixiGraphRuntime {
  app: Application;
  edgeLayer: Graphics;
  Graphics: typeof import("pixi.js").Graphics;
  hitLayer: Container;
  interactionOptions: PixiGraphInteractionOptions | null;
  labelLayer: Container;
  labelsByPath: Map<string, Text>;
  motionLayer: Graphics;
  nodeHitByPath: Map<string, GraphNodeHit>;
  nodeLayer: Graphics;
  resizeObserver: ResizeObserver | null;
  root: Container;
  Text: typeof import("pixi.js").Text;
}

interface GraphNodeHit extends Graphics {
  relicNode?: GraphRenderNode;
}

interface PixiGraphInteractionOptions {
  activePointerPointRef: MutableRefObject<GraphPoint | null>;
  isMotionAfterglow: boolean;
  motionEpoch: number;
  onNodeClick: (point: GraphPoint) => void;
  onNodePointerCancel: (event: GraphNodePointerEvent) => void;
  onNodePointerDown: (event: GraphNodePointerEvent, point: GraphPoint) => void;
  onNodePointerEnter: (path: string) => void;
  onNodePointerLeave: (path: string) => void;
  onNodePointerMove: (event: GraphNodePointerEvent) => void;
  onNodePointerUp: (event: GraphNodePointerEvent, point: GraphPoint) => void;
  showArrows: boolean;
}

export function GraphCanvas({
  edges,
  focusedPath,
  groupByPath,
  isMotionAfterglow,
  isPanning,
  labelOpacity,
  linkThickness,
  motionEpoch,
  motionPath,
  nodeSize,
  onGraphKeyDown,
  onGraphPointerCancel,
  onGraphPointerDown,
  onGraphPointerMove,
  onGraphPointerUp,
  onGraphWheel,
  onNodeClick,
  onNodeKeyDown,
  onNodePointerCancel,
  onNodePointerDown,
  onNodePointerEnter,
  onNodePointerLeave,
  onNodePointerMove,
  onNodePointerUp,
  points,
  relatedPaths,
  selectedPath,
  showArrows,
  showLabels,
  surfaceRef,
  viewBox
}: GraphCanvasProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pixiRef = useRef<PixiGraphRuntime | null>(null);
  const activePointerPointRef = useRef<GraphPoint | null>(null);
  const latestPointsRef = useRef(points);
  const latestViewBoxRef = useRef(viewBox);
  const [isReady, setIsReady] = useState(false);
  const [pixiError, setPixiError] = useState<string | null>(null);
  const renderState = useMemo(() => buildGraphRenderState({
    edges,
    focusedPath,
    groupByPath,
    labelOpacity,
    linkThickness,
    motionPath,
    nodeSize,
    palette: defaultGraphRenderPalette,
    points,
    relatedPaths,
    selectedPath,
    showLabels
  }), [edges, focusedPath, groupByPath, labelOpacity, linkThickness, motionPath, nodeSize, points, relatedPaths, selectedPath, showLabels]);

  latestPointsRef.current = points;
  latestViewBoxRef.current = viewBox;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const currentHost = host;
    if (import.meta.env.MODE === "test") return undefined;

    let isDisposed = false;
    let app: Application | null = null;

    async function initPixi(): Promise<void> {
      try {
        await import("pixi.js/unsafe-eval");
        const pixi = await import("pixi.js");
        app = new pixi.Application();
        await app.init({
          antialias: true,
          autoDensity: true,
          autoStart: false,
          backgroundAlpha: 0,
          height: Math.max(1, currentHost.clientHeight),
          preference: ["webgl", "canvas"],
          resolution: window.devicePixelRatio || 1,
          width: Math.max(1, currentHost.clientWidth)
        });
        if (isDisposed) {
          app.destroy(true);
          return;
        }

        app.canvas.className = "graph-pixi-canvas";
        currentHost.appendChild(app.canvas);

        const root = new pixi.Container();
        const edgeLayer = new pixi.Graphics();
        const motionLayer = new pixi.Graphics();
        const nodeLayer = new pixi.Graphics();
        const hitLayer = new pixi.Container();
        const labelLayer = new pixi.Container();

        const initializedApp = app;

        initializedApp.stage.addChild(root);
        root.addChild(edgeLayer, motionLayer, nodeLayer, labelLayer, hitLayer);
        initializedApp.stage.eventMode = "static";

        const resize = (): void => {
          const width = Math.max(1, currentHost.clientWidth);
          const height = Math.max(1, currentHost.clientHeight);
          initializedApp.renderer.resize(width, height);
          initializedApp.stage.hitArea = new pixi.Rectangle(0, 0, width, height);
          const runtime = pixiRef.current;
          if (runtime) {
            applyGraphViewBox(runtime, latestViewBoxRef.current);
            runtime.app.render();
          }
        };
        resize();

        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
        resizeObserver?.observe(currentHost);

        pixiRef.current = {
          app: initializedApp,
          edgeLayer,
          Graphics: pixi.Graphics,
          hitLayer,
          interactionOptions: null,
          labelLayer,
          labelsByPath: new Map(),
          motionLayer,
          nodeHitByPath: new Map(),
          nodeLayer,
          resizeObserver,
          root,
          Text: pixi.Text
        };
        initializedApp.stage.on("globalpointermove", (event) => {
          pixiRef.current?.interactionOptions?.onNodePointerMove(toGraphNodePointerEvent(event));
        });
        initializedApp.stage.on("pointercancel", (event) => {
          const options = pixiRef.current?.interactionOptions;
          if (!options?.activePointerPointRef.current) return;

          options.onNodePointerCancel(toGraphNodePointerEvent(event));
          options.activePointerPointRef.current = null;
        });
        setPixiError(null);
        setIsReady(true);
      } catch (error) {
        if (isDisposed) return;
        setPixiError(error instanceof Error ? error.message : String(error));
      }
    }

    void initPixi();

    return () => {
      isDisposed = true;
      const runtime = pixiRef.current;
      pixiRef.current = null;
      runtime?.resizeObserver?.disconnect();
      try {
        app?.destroy(true);
      } catch {
        // Pixi can be partially initialized when renderer setup fails.
      }
      setIsReady(false);
    };
  }, []);

  useEffect(() => {
    const runtime = pixiRef.current;
    const host = hostRef.current;
    if (!runtime || !host || !isReady) return;

    drawGraph(runtime, buildGraphRenderState({
      edges,
      focusedPath,
      groupByPath,
      labelOpacity,
      linkThickness,
      motionPath,
      nodeSize,
      palette: readGraphPalette(host),
      points,
      relatedPaths,
      selectedPath,
      showLabels
    }), {
      activePointerPointRef,
      isMotionAfterglow,
      motionEpoch,
      onNodeClick,
      onNodePointerCancel,
      onNodePointerDown,
      onNodePointerEnter,
      onNodePointerLeave,
      onNodePointerMove,
      onNodePointerUp,
      showArrows
    });
    applyGraphViewBox(runtime, viewBox);
    runtime.app.render();
  }, [
    edges,
    focusedPath,
    groupByPath,
    isMotionAfterglow,
    isReady,
    labelOpacity,
    linkThickness,
    motionEpoch,
    motionPath,
    nodeSize,
    onNodeClick,
    onNodePointerCancel,
    onNodePointerDown,
    onNodePointerEnter,
    onNodePointerLeave,
    onNodePointerMove,
    onNodePointerUp,
    points,
    relatedPaths,
    selectedPath,
    showArrows,
    showLabels,
    viewBox
  ]);

  useEffect(() => {
    const runtime = pixiRef.current;
    if (!runtime || !isReady) return;
    applyGraphViewBox(runtime, viewBox);
    runtime.app.render();
  }, [isReady, viewBox]);

  function setSurfaceElement(element: HTMLDivElement | null): void {
    hostRef.current = element;
    (surfaceRef as MutableRefObject<HTMLDivElement | null>).current = element;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    onGraphKeyDown(event);
    if (event.defaultPrevented) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    const keyboardPath = focusedPath ?? selectedPath;
    const point = keyboardPath ? latestPointsRef.current.find((candidate) => candidate.path === keyboardPath) : null;
    if (point) onNodeKeyDown(event, point);
  }

  const className = [
    "graph-pixi-surface",
    isPanning ? "graph-pixi-surface--panning" : "",
    renderState.isLargeGraph ? "graph-pixi-surface--large" : ""
  ].filter(Boolean).join(" ");

  return (
    <div
      aria-label="Graph"
      className={className}
      data-edge-count={renderState.edges.length}
      data-node-count={renderState.nodes.length}
      data-renderer="pixi"
      onKeyDown={handleKeyDown}
      onPointerCancel={onGraphPointerCancel}
      onPointerDown={onGraphPointerDown}
      onPointerMove={onGraphPointerMove}
      onPointerUp={onGraphPointerUp}
      onWheel={onGraphWheel}
      ref={setSurfaceElement}
      role="img"
      tabIndex={0}
    >
      {pixiError ? <div className="graph-renderer-error">{pixiError}</div> : null}
    </div>
  );
}

function drawGraph(
  runtime: PixiGraphRuntime,
  state: GraphRenderState,
  options: PixiGraphInteractionOptions
): void {
  runtime.interactionOptions = options;
  runtime.edgeLayer.clear();
  runtime.motionLayer.clear();
  runtime.nodeLayer.clear();

  state.edges.forEach((edge) => drawEdge(runtime.edgeLayer, edge, options.showArrows));
  state.edges
    .filter((edge) => edge.isMotion)
    .forEach((edge, index) => drawMotionEdge(runtime.motionLayer, edge, options.isMotionAfterglow, options.motionEpoch + index));
  state.nodes.forEach((node) => drawNode(runtime.nodeLayer, node));
  updateHitLayer(runtime, state.nodes, options);
  updateLabelLayer(runtime, state);
}

function drawEdge(layer: Graphics, edge: GraphRenderEdge, showArrows: boolean): void {
  layer
    .moveTo(edge.x1, edge.y1)
    .lineTo(edge.x2, edge.y2)
    .stroke({ alpha: edge.alpha, color: edge.color, width: edge.strokeWidth });

  if (!showArrows) return;

  const angle = Math.atan2(edge.y2 - edge.y1, edge.x2 - edge.x1);
  const arrowLength = edge.isFocused ? 9 : 7;
  const arrowWidth = edge.isFocused ? 5 : 4;
  const tipX = edge.x2;
  const tipY = edge.y2;
  const baseX = tipX - Math.cos(angle) * arrowLength;
  const baseY = tipY - Math.sin(angle) * arrowLength;
  const normalX = Math.cos(angle + Math.PI / 2) * arrowWidth;
  const normalY = Math.sin(angle + Math.PI / 2) * arrowWidth;

  layer
    .poly([
      tipX, tipY,
      baseX + normalX, baseY + normalY,
      baseX - normalX, baseY - normalY
    ], true)
    .fill({ alpha: edge.isFocused ? 0.78 : 0.52, color: edge.color });
}

function drawMotionEdge(layer: Graphics, edge: GraphRenderEdge, isAfterglow: boolean, epoch: number): void {
  const alpha = isAfterglow ? Math.max(0.18, 0.38 - (epoch % 3) * 0.04) : 0.7;
  layer
    .moveTo(edge.x1, edge.y1)
    .lineTo(edge.x2, edge.y2)
    .stroke({ alpha, color: edge.color, width: Math.max(1.4, edge.strokeWidth * 1.7) });
}

function drawNode(layer: Graphics, node: GraphRenderNode): void {
  if (node.ringVisible) {
    layer
      .circle(node.x, node.y, node.radius + 5)
      .stroke({ alpha: 0.9, color: node.strokeColor, width: 1.9 });
  }

  layer
    .circle(node.x, node.y, node.radius)
    .fill({ alpha: node.fillAlpha, color: node.fillColor })
    .stroke({ alpha: node.strokeAlpha, color: node.strokeColor, width: node.strokeWidth });
}

function updateHitLayer(
  runtime: PixiGraphRuntime,
  nodes: GraphRenderNode[],
  options: PixiGraphInteractionOptions
): void {
  const nextPaths = new Set(nodes.map((node) => node.path));

  for (const [path, hit] of runtime.nodeHitByPath) {
    if (nextPaths.has(path)) continue;
    runtime.hitLayer.removeChild(hit);
    hit.destroy();
    runtime.nodeHitByPath.delete(path);
  }

  nodes.forEach((node) => {
    let hit = runtime.nodeHitByPath.get(node.path);
    if (!hit) {
      const createdHit = new runtime.Graphics() as GraphNodeHit;
      createdHit.eventMode = "static";
      createdHit.cursor = "grab";
      runtime.hitLayer.addChild(createdHit);
      runtime.nodeHitByPath.set(node.path, createdHit);

      createdHit.on("pointerdown", (event) => {
        const currentNode = createdHit.relicNode ?? node;
        const point = renderNodeToGraphPoint(currentNode);
        options.activePointerPointRef.current = point;
        options.onNodePointerDown(toGraphNodePointerEvent(event), point);
      });
      createdHit.on("pointerup", (event) => {
        const point = options.activePointerPointRef.current ?? renderNodeToGraphPoint(createdHit.relicNode ?? node);
        options.onNodePointerUp(toGraphNodePointerEvent(event), point);
        options.activePointerPointRef.current = null;
      });
      createdHit.on("pointerupoutside", (event) => {
        const point = options.activePointerPointRef.current ?? renderNodeToGraphPoint(createdHit.relicNode ?? node);
        options.onNodePointerUp(toGraphNodePointerEvent(event), point);
        options.activePointerPointRef.current = null;
      });
      createdHit.on("pointertap", () => {
        options.onNodeClick(renderNodeToGraphPoint(createdHit.relicNode ?? node));
      });
      createdHit.on("pointerenter", () => options.onNodePointerEnter(node.path));
      createdHit.on("pointerleave", () => options.onNodePointerLeave(node.path));
      hit = createdHit;
    }

    hit.relicNode = node;
    hit.clear()
      .circle(node.x, node.y, Math.max(12, node.radius + 6))
      .fill({ alpha: 0.001, color: 0xffffff });
  });
}

function updateLabelLayer(runtime: PixiGraphRuntime, state: GraphRenderState): void {
  const visibleNodes = state.nodes.filter((node) => node.labelVisible);
  const visiblePaths = new Set(visibleNodes.map((node) => node.path));

  for (const [path, label] of runtime.labelsByPath) {
    if (visiblePaths.has(path)) continue;
    runtime.labelLayer.removeChild(label);
    label.destroy();
    runtime.labelsByPath.delete(path);
  }

  visibleNodes.forEach((node) => {
    let label = runtime.labelsByPath.get(node.path);
    if (!label) {
      label = new runtime.Text({
        style: {
          fill: state.palette.text,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 9
        },
        text: node.name
      });
      label.eventMode = "none";
      runtime.labelLayer.addChild(label);
      runtime.labelsByPath.set(node.path, label);
    }
    label.text = node.name;
    label.alpha = node.labelAlpha;
    label.style.fill = state.palette.text;
    label.x = node.x + node.radius + 5;
    label.y = node.y - 6;
  });
}

function applyGraphViewBox(runtime: PixiGraphRuntime, viewBox: GraphViewBox): void {
  const transform = buildGraphViewBoxTransform(
    runtime.app.renderer.screen.width,
    runtime.app.renderer.screen.height,
    viewBox
  );

  runtime.root.scale.set(transform.scaleX, transform.scaleY);
  runtime.root.position.set(transform.x, transform.y);
}

export function buildGraphViewBoxTransform(
  width: number,
  height: number,
  viewBox: GraphViewBox
): GraphViewBoxTransform {
  const scaleX = width / viewBox.width;
  const scaleY = height / viewBox.height;

  return {
    scaleX,
    scaleY,
    x: -viewBox.x * scaleX,
    y: -viewBox.y * scaleY
  };
}

function renderNodeToGraphPoint(node: GraphRenderNode): GraphPoint {
  return {
    degree: node.degree,
    folder: node.folder,
    incoming: node.incoming,
    name: node.name,
    outgoing: node.outgoing,
    path: node.path,
    tags: node.tags,
    x: node.x,
    y: node.y
  };
}

function toGraphNodePointerEvent(event: FederatedPointerEvent): GraphNodePointerEvent {
  return {
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY,
    pointerId: event.pointerId,
    stopPropagation: () => {
      event.stopPropagation();
      if ("stopPropagation" in event.nativeEvent) event.nativeEvent.stopPropagation();
    }
  };
}
