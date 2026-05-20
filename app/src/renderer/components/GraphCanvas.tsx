import { useEffect, useRef, useState } from "react";
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
import type { GraphPoint, GraphSimPoint, GraphViewBox } from "../graphLayout";
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
import type { GraphViewportController } from "../hooks/useGraphViewportInteractions";

export interface GraphViewBoxTransform {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

interface GraphRevealFrame {
  elapsedMs: number;
}

export type GraphRenderReason = "camera" | "geometry" | "reveal" | "style";

export interface GraphCanvasProps {
  animationEpoch: number;
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
  pointsRef: MutableRefObject<GraphSimPoint[]>;
  relatedPaths: Set<string>;
  selectedPath: string | null;
  showArrows: boolean;
  showLabels: boolean;
  surfaceRef: RefObject<HTMLDivElement | null>;
  viewportController: GraphViewportController;
  viewBox: GraphViewBox;
}

interface PixiGraphRuntime {
  app: Application;
  edgeGraphicsByKey: Map<string, GraphEdgeGraphic>;
  edgeLayer: Container;
  Graphics: typeof import("pixi.js").Graphics;
  hitLayer: Container;
  interactionOptions: PixiGraphInteractionOptions | null;
  labelLayer: Container;
  labelsByPath: Map<string, GraphLabelText>;
  motionLayerSignature: string | null;
  motionLayer: Graphics;
  nodeGraphicsByPath: Map<string, GraphNodeGraphic>;
  nodeHitByPath: Map<string, GraphNodeHit>;
  nodeLayer: Container;
  pendingFrame: number | null;
  pendingReasons: Set<GraphRenderReason>;
  renderedPointsByPath: Map<string, GraphSimPoint>;
  revealEpoch: number;
  revealStartedAtMs: number | null;
  resizeObserver: ResizeObserver | null;
  root: Container;
  Text: typeof import("pixi.js").Text;
  viewScale: number;
  viewScaleBucket: string;
  viewBoxTransformKey: string | null;
}

interface GraphNodeHit extends Graphics {
  relicHitRadius?: number;
  relicHitSignature?: string;
  relicNode?: GraphRenderNode;
}

interface GraphNodeGraphic extends Graphics {
  relicSignature?: string;
}

interface GraphEdgeGraphic extends Graphics {
  relicSignature?: string;
}

interface GraphLabelText extends Text {
  relicSignature?: string;
}

interface PixiGraphInteractionOptions {
  activePointerPointRef: MutableRefObject<GraphPoint | null>;
  animationEpoch: number;
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

interface GraphCanvasRenderInput {
  edges: WorkspaceGraphEdge[];
  focusedPath: string | null;
  groupByPath: Map<string, GraphGroup>;
  labelOpacity: number;
  linkThickness: number;
  motionPath: string | null;
  nodeSize: number;
  palette: GraphRenderState["palette"];
  relatedPaths: Set<string>;
  selectedPath: string | null;
  showLabels: boolean;
}

export function GraphCanvas({
  animationEpoch,
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
  pointsRef,
  relatedPaths,
  selectedPath,
  showArrows,
  showLabels,
  surfaceRef,
  viewportController,
  viewBox
}: GraphCanvasProps): ReactElement {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pixiRef = useRef<PixiGraphRuntime | null>(null);
  const activePointerPointRef = useRef<GraphPoint | null>(null);
  const latestPointsRef = useRef(points);
  const latestViewBoxRef = useRef(viewBox);
  const latestRenderInputRef = useRef<GraphCanvasRenderInput>({
    edges,
    focusedPath,
    groupByPath,
    labelOpacity,
    linkThickness,
    motionPath,
    nodeSize,
    palette: defaultGraphRenderPalette,
    relatedPaths,
    selectedPath,
    showLabels
  });
  const latestInteractionOptionsRef = useRef<PixiGraphInteractionOptions | null>(null);
  const viewBoxScaleKeyRef = useRef(`${viewBox.width}:${viewBox.height}`);
  const [isReady, setIsReady] = useState(false);
  const [pixiError, setPixiError] = useState<string | null>(null);
  const isLargeGraph = points.length > 220 || edges.length > 520;

  latestPointsRef.current = pointsRef.current.length > 0 ? pointsRef.current : points;
  latestViewBoxRef.current = viewportController.liveViewBoxRef.current ?? viewBox;
  latestRenderInputRef.current = {
    edges,
    focusedPath,
    groupByPath,
    labelOpacity,
    linkThickness,
    motionPath,
    nodeSize,
    palette: defaultGraphRenderPalette,
    relatedPaths,
    selectedPath,
    showLabels
  };
  latestInteractionOptionsRef.current = {
    activePointerPointRef,
    animationEpoch,
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
  };

  function scheduleRender(reason: GraphRenderReason): void {
    const runtime = pixiRef.current;
    if (!runtime) return;

    runtime.pendingReasons.add(reason);
    if (runtime.pendingFrame !== null) return;

    runtime.pendingFrame = window.requestAnimationFrame(renderScheduledFrame);
  }

  function renderScheduledFrame(): void {
    const runtime = pixiRef.current;
    const options = latestInteractionOptionsRef.current;
    if (!runtime || !options) return;

    const reasons = new Set(runtime.pendingReasons);
    runtime.pendingReasons.clear();
    runtime.pendingFrame = null;
    applyGraphViewBox(runtime, latestViewBoxRef.current);
    const nextScaleBucket = graphViewScaleBucket(runtime.viewScale);
    if (runtime.viewScaleBucket !== nextScaleBucket) {
      runtime.viewScaleBucket = nextScaleBucket;
      reasons.add("style");
    }

    if (runtime.revealEpoch !== options.animationEpoch) {
      reasons.add("reveal");
    }

    const shouldRedrawLayers = graphRenderReasonsNeedLayerRedraw(reasons);
    let revealFrame: GraphRevealFrame | null = null;
    if (shouldRedrawLayers) {
      const renderPoints = interpolateGraphFramePoints(
        runtime,
        pointsRef.current,
        options.activePointerPointRef.current?.path ?? null
      );
      const nowMs = typeof performance === "undefined" ? Date.now() : performance.now();
      revealFrame = updateGraphRevealFrame(runtime, options.animationEpoch, nowMs);
      drawGraph(runtime, buildGraphRenderState({
        ...latestRenderInputRef.current,
        points: renderPoints,
        viewScale: runtime.viewScale
      }), options, revealFrame);
    }

    runtime.app.render();
    if (revealFrame) scheduleRender("reveal");
  }

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
        const edgeLayer = new pixi.Container();
        const motionLayer = new pixi.Graphics();
        const nodeLayer = new pixi.Container();
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
            scheduleRender("style");
          }
        };
        resize();

        const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
        resizeObserver?.observe(currentHost);

        pixiRef.current = {
          app: initializedApp,
          edgeGraphicsByKey: new Map(),
          edgeLayer,
          Graphics: pixi.Graphics,
          hitLayer,
          interactionOptions: null,
          labelLayer,
          labelsByPath: new Map(),
          motionLayerSignature: null,
          motionLayer,
          nodeGraphicsByPath: new Map(),
          nodeHitByPath: new Map(),
          nodeLayer,
          pendingFrame: null,
          pendingReasons: new Set(),
          renderedPointsByPath: new Map(),
          revealEpoch: latestInteractionOptionsRef.current?.animationEpoch ?? 0,
          revealStartedAtMs: null,
          resizeObserver,
          root,
          Text: pixi.Text,
          viewScale: 1,
          viewScaleBucket: graphViewScaleBucket(1),
          viewBoxTransformKey: null
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
        scheduleRender("geometry");
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
      if (runtime?.pendingFrame !== null && runtime?.pendingFrame !== undefined) {
        window.cancelAnimationFrame(runtime.pendingFrame);
      }
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

    latestRenderInputRef.current = {
      ...latestRenderInputRef.current,
      palette: readGraphPalette(host)
    };
    scheduleRender("style");
  }, [
    isReady,
    focusedPath,
    groupByPath,
    labelOpacity,
    linkThickness,
    motionPath,
    nodeSize,
    relatedPaths,
    selectedPath,
    showLabels
  ]);

  useEffect(() => {
    if (!isReady) return;
    scheduleRender("geometry");
  }, [edges, isReady, points, pointsRef]);

  useEffect(() => {
    if (!isReady) return;
    latestViewBoxRef.current = viewBox;
    const nextScaleKey = `${viewBox.width}:${viewBox.height}`;
    const reason: GraphRenderReason = viewBoxScaleKeyRef.current === nextScaleKey ? "camera" : "style";
    viewBoxScaleKeyRef.current = nextScaleKey;
    scheduleRender(reason);
  }, [isReady, viewBox]);

  useEffect(() => {
    if (!isReady) return;
    scheduleRender("reveal");
  }, [animationEpoch, isReady]);

  useEffect(() => {
    if (!isReady) return undefined;
    return viewportController.subscribe(() => {
      latestViewBoxRef.current = viewportController.liveViewBoxRef.current;
      scheduleRender("camera");
    });
  }, [isReady, viewportController]);

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
    isLargeGraph ? "graph-pixi-surface--large" : ""
  ].filter(Boolean).join(" ");

  return (
    <div
      aria-label="Graph"
      className={className}
      data-edge-count={edges.length}
      data-node-count={points.length}
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

export function graphRenderReasonsNeedLayerRedraw(reasons: ReadonlySet<GraphRenderReason>): boolean {
  return reasons.has("geometry") || reasons.has("style") || reasons.has("reveal");
}

function drawGraph(
  runtime: PixiGraphRuntime,
  state: GraphRenderState,
  options: PixiGraphInteractionOptions,
  revealFrame: GraphRevealFrame | null
): void {
  const drawableState = revealFrame ? buildGraphRevealState(state, revealFrame.elapsedMs) : state;
  runtime.interactionOptions = options;

  updateEdgeLayer(runtime, drawableState.edges, options.showArrows);
  updateMotionLayer(runtime, drawableState.edges, options);
  updateNodeLayer(runtime, drawableState.nodes);
  updateHitLayer(runtime, drawableState.nodes, options);
  updateLabelLayer(runtime, drawableState);
}

function updateEdgeLayer(
  runtime: PixiGraphRuntime,
  edges: GraphRenderEdge[],
  showArrows: boolean
): void {
  const nextKeys = new Set(edges.map(graphEdgeKey));

  for (const [key, graphic] of runtime.edgeGraphicsByKey) {
    if (nextKeys.has(key)) continue;
    runtime.edgeLayer.removeChild(graphic);
    graphic.destroy();
    runtime.edgeGraphicsByKey.delete(key);
  }

  edges.forEach((edge) => {
    const key = graphEdgeKey(edge);
    let graphic = runtime.edgeGraphicsByKey.get(key);
    if (!graphic) {
      graphic = new runtime.Graphics() as GraphEdgeGraphic;
      runtime.edgeLayer.addChild(graphic);
      runtime.edgeGraphicsByKey.set(key, graphic);
    }

    const signature = buildGraphEdgeDrawSignature(edge, showArrows);
    if (graphic.relicSignature === signature) return;

    graphic.clear();
    drawEdge(graphic, edge, showArrows);
    graphic.relicSignature = signature;
  });
}

function updateMotionLayer(
  runtime: PixiGraphRuntime,
  edges: GraphRenderEdge[],
  options: PixiGraphInteractionOptions
): void {
  const motionEdges = edges.filter((edge) => edge.isMotion);
  const signature = motionEdges
    .map((edge, index) => `${buildGraphEdgeDrawSignature(edge, false)}:${options.isMotionAfterglow}:${options.motionEpoch + index}`)
    .join("|");
  if (runtime.motionLayerSignature === signature) return;

  runtime.motionLayer.clear();
  motionEdges.forEach((edge, index) => drawMotionEdge(runtime.motionLayer, edge, options.isMotionAfterglow, options.motionEpoch + index));
  runtime.motionLayerSignature = signature;
}

function updateNodeLayer(runtime: PixiGraphRuntime, nodes: GraphRenderNode[]): void {
  const nextPaths = new Set(nodes.map((node) => node.path));

  for (const [path, graphic] of runtime.nodeGraphicsByPath) {
    if (nextPaths.has(path)) continue;
    runtime.nodeLayer.removeChild(graphic);
    graphic.destroy();
    runtime.nodeGraphicsByPath.delete(path);
  }

  nodes.forEach((node) => {
    let graphic = runtime.nodeGraphicsByPath.get(node.path);
    if (!graphic) {
      graphic = new runtime.Graphics() as GraphNodeGraphic;
      runtime.nodeLayer.addChild(graphic);
      runtime.nodeGraphicsByPath.set(node.path, graphic);
    }

    const signature = buildGraphNodeDrawSignature(node);
    if (graphic.relicSignature === signature) return;

    graphic.clear();
    drawNode(graphic, node);
    graphic.relicSignature = signature;
  });
}

export function graphEdgeKey(edge: Pick<GraphRenderEdge, "sourcePath" | "targetPath">): string {
  return `${edge.sourcePath}\u0000${edge.targetPath}`;
}

export function buildGraphEdgeDrawSignature(edge: GraphRenderEdge, showArrows: boolean): string {
  return [
    roundGraphDrawValue(edge.x1),
    roundGraphDrawValue(edge.y1),
    roundGraphDrawValue(edge.x2),
    roundGraphDrawValue(edge.y2),
    roundGraphDrawValue(edge.alpha),
    edge.color,
    roundGraphDrawValue(edge.strokeWidth),
    showArrows ? 1 : 0
  ].join(":");
}

export function buildGraphNodeDrawSignature(node: GraphRenderNode): string {
  return [
    roundGraphDrawValue(node.x),
    roundGraphDrawValue(node.y),
    roundGraphDrawValue(node.radius),
    roundGraphDrawValue(node.fillAlpha),
    node.fillColor,
    node.ringVisible ? 1 : 0,
    roundGraphDrawValue(node.strokeAlpha),
    node.strokeColor,
    roundGraphDrawValue(node.strokeWidth)
  ].join(":");
}

function roundGraphDrawValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function drawEdge(layer: Graphics, edge: GraphRenderEdge, showArrows: boolean): void {
  layer
    .moveTo(edge.x1, edge.y1)
    .lineTo(edge.x2, edge.y2)
    .stroke({ alpha: edge.alpha, color: edge.color, width: edge.strokeWidth });

  if (!showArrows) return;

  const angle = Math.atan2(edge.y2 - edge.y1, edge.x2 - edge.x1);
  const arrowLength = 7;
  const arrowWidth = 4;
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
    .fill({ alpha: Math.min(edge.alpha, 0.52), color: edge.color });
}

function updateGraphRevealFrame(
  runtime: PixiGraphRuntime,
  animationEpoch: number,
  nowMs: number
): GraphRevealFrame | null {
  if (runtime.revealEpoch !== animationEpoch) {
    runtime.revealEpoch = animationEpoch;
    runtime.revealStartedAtMs = nowMs;
  }
  if (runtime.revealStartedAtMs === null) return null;

  const elapsedMs = nowMs - runtime.revealStartedAtMs;
  if (elapsedMs >= graphRevealTotalMs) {
    runtime.revealStartedAtMs = null;
    return null;
  }
  return { elapsedMs };
}

const graphRevealNodeStepMs = 14;
const graphRevealNodeFadeMs = 12;
const graphRevealEdgeDelayMs = 3;
const graphRevealEdgeFadeMs = 80;
const graphRevealTotalMs = 15000;

export function buildGraphRevealState(state: GraphRenderState, elapsedMs: number): GraphRenderState {
  const nodeIndexByPath = new Map(state.nodes.map((node, index) => [node.path, index]));
  const nodeProgressByPath = new Map<string, number>();
  const nodes = state.nodes.map((node, index) => {
    const startMs = index * graphRevealNodeStepMs;
    const progress = easeOutCubic(clampUnit((elapsedMs - startMs) / graphRevealNodeFadeMs));
    nodeProgressByPath.set(node.path, progress);
    return {
      ...node,
      fillAlpha: node.fillAlpha * progress,
      labelAlpha: node.labelAlpha * clampUnit((progress - 0.62) / 0.38),
      radius: node.radius * progress,
      strokeAlpha: node.strokeAlpha * progress,
      strokeWidth: node.strokeWidth * progress
    };
  });
  const edges = state.edges.map((edge) => {
    const sourceProgress = nodeProgressByPath.get(edge.sourcePath) ?? 0;
    const targetProgress = nodeProgressByPath.get(edge.targetPath) ?? 0;
    const sourceIndex = nodeIndexByPath.get(edge.sourcePath) ?? 0;
    const targetIndex = nodeIndexByPath.get(edge.targetPath) ?? 0;
    const startMs = Math.max(sourceIndex, targetIndex, 0) * graphRevealNodeStepMs + graphRevealEdgeDelayMs;
    const progress = easeOutCubic(clampUnit((elapsedMs - startMs) / graphRevealEdgeFadeMs)) * Math.min(sourceProgress, targetProgress);
    return {
      ...edge,
      alpha: edge.alpha * progress,
      strokeWidth: edge.strokeWidth * progress,
      x2: edge.x1 + (edge.x2 - edge.x1) * progress,
      y2: edge.y1 + (edge.y2 - edge.y1) * progress
    };
  });
  return { ...state, edges, nodes };
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function drawMotionEdge(layer: Graphics, edge: GraphRenderEdge, isAfterglow: boolean, epoch: number): void {
  const alpha = isAfterglow ? Math.max(0.14, 0.26 - (epoch % 3) * 0.03) : 0.42;
  layer
    .moveTo(edge.x1, edge.y1)
    .lineTo(edge.x2, edge.y2)
    .stroke({ alpha, color: edge.color, width: Math.max(1, edge.strokeWidth * 1.28) });
}

function drawNode(layer: Graphics, node: GraphRenderNode): void {
  if (node.ringVisible) {
    layer
      .circle(node.x, node.y, node.radius + 2.8)
      .stroke({ alpha: 0.56, color: node.strokeColor, width: 1.05 });
  }

  layer
    .circle(node.x, node.y, node.radius)
    .fill({ alpha: node.fillAlpha, color: node.fillColor })
    .stroke({ alpha: node.strokeAlpha, color: node.strokeColor, width: node.strokeWidth });
}

function interpolateGraphFramePoints(
  runtime: PixiGraphRuntime,
  targetPoints: GraphSimPoint[],
  immediatePath: string | null
): GraphSimPoint[] {
  const targetPaths = new Set(targetPoints.map((point) => point.path));
  for (const path of runtime.renderedPointsByPath.keys()) {
    if (!targetPaths.has(path)) runtime.renderedPointsByPath.delete(path);
  }

  if (runtime.renderedPointsByPath.size === 0) {
    targetPoints.forEach((point) => runtime.renderedPointsByPath.set(point.path, point));
    return targetPoints;
  }

  const interpolation = 0.34;
  return targetPoints.map((point) => {
    const previous = runtime.renderedPointsByPath.get(point.path);
    if (!previous || point.path === immediatePath) {
      runtime.renderedPointsByPath.set(point.path, point);
      return point;
    }

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const nextPoint = Math.hypot(dx, dy) < 0.05
      ? point
      : {
        ...point,
        x: previous.x + dx * interpolation,
        y: previous.y + dy * interpolation
      };
    runtime.renderedPointsByPath.set(point.path, nextPoint);
    return nextPoint;
  });
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
    const hitRadius = buildGraphNodeHitRadius(node.radius, runtime.viewScale);
    const hitSignature = `${roundGraphDrawValue(node.x)}:${roundGraphDrawValue(node.y)}:${hitRadius}`;
    if (hit.relicHitSignature !== hitSignature) {
      hit.position.set(node.x, node.y);
      hit.clear()
        .circle(0, 0, hitRadius)
        .fill({ alpha: 0.001, color: 0xffffff });
      hit.relicHitRadius = hitRadius;
      hit.relicHitSignature = hitSignature;
    }
  });
}

export function buildGraphNodeHitRadius(nodeRadius: number, viewScale: number): number {
  const safeScale = Math.max(0.001, viewScale);
  const screenRadius = nodeRadius * safeScale;
  return Math.round((Math.max(10, screenRadius + 4) / safeScale) * 10) / 10;
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
        resolution: graphLabelTextureResolution(runtime.viewScale),
        style: {
          fill: state.palette.text,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 10
        },
        text: node.name
      }) as GraphLabelText;
      label.anchor.set(0.5, 0);
      label.eventMode = "none";
      runtime.labelLayer.addChild(label);
      runtime.labelsByPath.set(node.path, label);
    }
    const signature = buildGraphLabelDrawSignature(node, runtime.viewScale, state.palette.text);
    if (label.relicSignature === signature) return;

    label.text = node.name;
    label.alpha = node.labelAlpha;
    label.resolution = graphLabelTextureResolution(runtime.viewScale);
    label.style.fill = state.palette.text;
    label.style.fontSize = 10;
    label.scale.set(graphLabelScreenScale(runtime.viewScale));
    const placement = buildGraphLabelPlacement(node, runtime.viewScale);
    label.x = placement.x;
    label.y = placement.y;
    label.relicSignature = signature;
  });
}

function buildGraphLabelDrawSignature(node: GraphRenderNode, viewScale: number, textColor: number): string {
  const placement = buildGraphLabelPlacement(node, viewScale);
  return [
    node.name,
    roundGraphDrawValue(node.labelAlpha),
    roundGraphDrawValue(viewScale),
    textColor,
    roundGraphDrawValue(placement.x),
    roundGraphDrawValue(placement.y)
  ].join(":");
}

function graphLabelScreenScale(viewScale: number): number {
  const safeScale = Math.max(0.001, viewScale);
  const targetScreenFontSize = Math.min(13, Math.max(4.5, 5 * Math.pow(safeScale, 0.8)));
  return targetScreenFontSize / (10 * safeScale);
}

export function buildGraphLabelPlacement(
  node: Pick<GraphRenderNode, "radius" | "x" | "y">,
  viewScale: number
): { x: number; y: number } {
  const safeScale = Math.max(0.001, viewScale);
  return {
    x: node.x,
    y: node.y + node.radius + 2 / safeScale
  };
}

function graphLabelTextureResolution(viewScale: number): number {
  const deviceScale = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(12, Math.max(deviceScale, deviceScale * Math.max(1, viewScale)));
}

export function graphViewScaleBucket(viewScale: number): string {
  const safeScale = Math.max(0.001, viewScale);
  if (safeScale < 0.8) return "far";
  if (safeScale < 1.6) return "default";
  if (safeScale < 2.6) return "near";
  if (safeScale < 4.2) return "label";
  return "detail";
}

function applyGraphViewBox(runtime: PixiGraphRuntime, viewBox: GraphViewBox): boolean {
  const screenWidth = runtime.app.renderer.screen.width;
  const screenHeight = runtime.app.renderer.screen.height;
  const transformKey = `${screenWidth}:${screenHeight}:${viewBox.x}:${viewBox.y}:${viewBox.width}:${viewBox.height}`;
  if (runtime.viewBoxTransformKey === transformKey) return false;

  const transform = buildGraphViewBoxTransform(
    screenWidth,
    screenHeight,
    viewBox
  );

  runtime.root.scale.set(transform.scaleX, transform.scaleY);
  runtime.root.position.set(transform.x, transform.y);
  runtime.viewScale = transform.scaleX;
  runtime.viewBoxTransformKey = transformKey;
  return true;
}

export function buildGraphViewBoxTransform(
  width: number,
  height: number,
  viewBox: GraphViewBox
): GraphViewBoxTransform {
  const scale = Math.min(width / viewBox.width, height / viewBox.height);

  return {
    scaleX: scale,
    scaleY: scale,
    x: (width - viewBox.width * scale) / 2 - viewBox.x * scale,
    y: (height - viewBox.height * scale) / 2 - viewBox.y * scale
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
