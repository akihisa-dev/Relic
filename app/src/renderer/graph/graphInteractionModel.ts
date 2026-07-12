import type React from "react";

import type { WorkspaceGraphNode } from "../../shared/ipc";
import {
  graphNodeBaseRadiusFromWeight,
  graphNodeWeight,
  graphSimulationLinks,
  graphSimulationNodes,
  resetGraphTimelapsePositions
} from "./graphLayout";
import type { GraphSimulationClient } from "./graphSimulationClient";
import type {
  GraphKeyboardState,
  GraphOptions,
  GraphSimLink,
  GraphSimNode,
  GraphViewTransform
} from "./graphTypes";

const graphMinScale = 1 / 128;
const graphMaxScale = 8;
const graphNodeClickMovementThresholdSq = 25;
const graphHoverReleaseDelayMs = 140;
const graphHighlightTransitionRate = 0.2;
const graphHighlightMinimumStrength = 0.01;

export interface GraphHoverFocusState {
  id: string | null;
  pointX?: number;
  pointY?: number;
  releaseAt: number;
}

export interface GraphHighlightState {
  id: string | null;
  strength: number;
}

export function initialGraphViewTransform(): GraphViewTransform {
  return {
    panX: 0,
    panY: 0,
    scale: 1,
    targetScale: 1,
    zoomCenterX: 0,
    zoomCenterY: 0
  };
}

export function animateGraph(
  nodes: Map<string, GraphSimNode>,
  links: GraphSimLink[],
  viewRef: React.MutableRefObject<GraphViewTransform>,
  simulationClient: GraphSimulationClient | null,
  options: GraphOptions
): void {
  viewRef.current = initialGraphViewTransform();
  resetGraphTimelapsePositions(nodes.values());
  simulationClient?.sync(
    graphSimulationNodes(nodes.values()),
    graphSimulationLinks(links),
    options,
    0.8
  );
}

export function graphNodeBaseRadius(node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount">, options: GraphOptions): number {
  return graphNodeBaseRadiusFromWeight(graphNodeWeight(node), options);
}

export function graphNodeScale(scale: number): number {
  return Math.sqrt(1 / Math.max(graphMinScale, scale));
}

export function graphLinkScaleOpacity(scale: number): number {
  return clamp((scale - 0.04) / 0.36, 0, 1);
}

export function graphNodeVisualRadius(
  node: Pick<WorkspaceGraphNode, "backlinkCount" | "linkCount">,
  options: GraphOptions,
  scale: number
): number {
  return graphNodeBaseRadius(node, options) * graphNodeScale(scale);
}

export function isGraphNodePrimaryPointerButton(button: number): boolean {
  return button === 0 || button === 1;
}

export function graphPointerMovedBeyondClickThreshold(dx: number, dy: number): boolean {
  return dx * dx + dy * dy > graphNodeClickMovementThresholdSq;
}

export function graphLabelOpacity(scale: number, textFadeMultiplier: number): number {
  return clamp(Math.log(scale) / Math.log(2) + 1 - textFadeMultiplier, 0, 1);
}

export function screenToWorld(
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

export function zoomGraphAtPoint(
  view: { panX: number; panY: number; scale: number },
  x: number,
  y: number,
  width: number,
  height: number,
  nextScale: number
): void {
  const before = screenToWorld(x, y, width, height, view);
  view.scale = clampGraphScale(nextScale);
  view.panX = x - width / 2 - before.x * view.scale;
  view.panY = y - height / 2 - before.y * view.scale;
}

export function graphWheelZoomPoint(
  currentScale: number,
  nextScale: number,
  pointerX: number,
  pointerY: number,
  width: number,
  height: number
): { x: number; y: number } {
  if (nextScale < currentScale) return { x: width / 2, y: height / 2 };

  return { x: pointerX, y: pointerY };
}

export function applyGraphKeyboardNavigation(
  view: { panX: number; panY: number; scale: number },
  keyboard: GraphKeyboardState
): void {
  const step = keyboard.shift ? 3 : 1;
  let dx = 0;
  let dy = 0;

  if (keyboard.left) dx += step;
  if (keyboard.right) dx -= step;
  if (keyboard.up) dy += step;
  if (keyboard.down) dy -= step;

  view.panX += dx * 1000 / 60;
  view.panY += dy * 1000 / 60;
}

export function applyGraphKeyboardZoom(
  view: GraphViewTransform,
  keyboard: GraphKeyboardState,
  width: number,
  height: number
): void {
  if (!keyboard.zoomIn && !keyboard.zoomOut) return;

  const step = keyboard.shift ? 1.1 : 1.03;
  let nextScale = view.targetScale;
  if (keyboard.zoomIn) nextScale *= step;
  if (keyboard.zoomOut) nextScale /= step;

  requestGraphZoom(view, width / 2, height / 2, nextScale);
}

export function requestGraphZoom(
  view: GraphViewTransform,
  x: number,
  y: number,
  nextScale: number
): void {
  view.targetScale = clampGraphScale(nextScale);
  view.zoomCenterX = x;
  view.zoomCenterY = y;
}

export function applyGraphZoomTransition(
  view: GraphViewTransform,
  width: number,
  height: number
): void {
  view.targetScale = clampGraphScale(view.targetScale);

  const currentScale = view.scale;
  const ratio = currentScale > view.targetScale ? currentScale / view.targetScale : view.targetScale / currentScale;
  if (ratio - 1 < 0.01) return;

  const zoomCenterX = view.zoomCenterX === 0 && view.zoomCenterY === 0 ? width / 2 : view.zoomCenterX;
  const zoomCenterY = view.zoomCenterX === 0 && view.zoomCenterY === 0 ? height / 2 : view.zoomCenterY;
  const nextScale = currentScale * 0.85 + view.targetScale * 0.15;

  zoomGraphAtPoint(view, zoomCenterX, zoomCenterY, width, height, nextScale);
}

export function nextGraphPanVelocity(
  current: { x: number; y: number },
  dx: number,
  dy: number
): { x: number; y: number } {
  return {
    x: current.x * 0.8 + dx * 0.2,
    y: current.y * 0.8 + dy * 0.2
  };
}

export function nextGraphPanSampleMs(current: number, elapsedMs: number): number {
  return current * 0.8 + elapsedMs * 0.2;
}

export function finishGraphPanVelocity(
  velocity: { x: number; y: number },
  sampleMs: number,
  releaseElapsedMs: number
): { x: number; y: number } {
  if (releaseElapsedMs > 100 || sampleMs <= 0) return { x: 0, y: 0 };

  return {
    x: velocity.x / sampleMs,
    y: velocity.y / sampleMs
  };
}

export function applyGraphPanInertia(
  view: { panX: number; panY: number; scale: number },
  velocity: { x: number; y: number }
): void {
  if (Math.abs(velocity.x) < 0.01) velocity.x = 0;
  if (Math.abs(velocity.y) < 0.01) velocity.y = 0;
  if (velocity.x === 0 && velocity.y === 0) return;

  view.panX += 1000 * velocity.x / 60;
  view.panY += 1000 * velocity.y / 60;
  velocity.x *= 0.9;
  velocity.y *= 0.9;
}

export function graphHoveredNodeContainsPoint(
  node: Pick<GraphSimNode, "backlinkCount" | "linkCount" | "type" | "x" | "y">,
  point: { x: number; y: number } | null,
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  width: number,
  height: number
): boolean {
  if (!point) return false;

  const world = screenToWorld(point.x, point.y, width, height, view);
  return distance(world.x, world.y, node.x, node.y) <= graphNodeVisualRadius(node, options, view.scale) + 4 / view.scale;
}

export function graphNodeAtCanvasPoint<T extends Pick<GraphSimNode, "backlinkCount" | "linkCount" | "x" | "y">>(
  nodes: Iterable<T>,
  point: { x: number; y: number },
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  width: number,
  height: number
): T | null {
  const world = screenToWorld(point.x, point.y, width, height, view);
  const nodeList = [...nodes].toReversed();

  for (const node of nodeList) {
    if (distance(world.x, world.y, node.x, node.y) <= graphNodeVisualRadius(node, options, view.scale) + 4 / view.scale) {
      return node;
    }
  }

  return null;
}

export function resolveGraphHoverFocusId(
  nodes: GraphSimNode[] | ReadonlyMap<string, GraphSimNode>,
  point: { x: number; y: number } | null,
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  width: number,
  height: number,
  state: GraphHoverFocusState,
  now: number
): string | null {
  if (point) {
    const world = screenToWorld(point.x, point.y, width, height, view);
    const pointUnchanged = state.pointX === point.x && state.pointY === point.y;
    const current = state.id
      ? (Array.isArray(nodes) ? nodes.find((node) => node.id === state.id) : nodes.get(state.id))
      : undefined;
    if (
      pointUnchanged &&
      current &&
      distance(world.x, world.y, current.x, current.y) <= graphNodeVisualRadius(current, options, view.scale) + 4 / view.scale
    ) {
      state.releaseAt = 0;
      return current.id;
    }

    state.pointX = point.x;
    state.pointY = point.y;
    const nodeList = Array.isArray(nodes) ? nodes : [...nodes.values()];
    for (let index = nodeList.length - 1; index >= 0; index -= 1) {
      const candidate = nodeList[index];
      if (
        candidate &&
        distance(world.x, world.y, candidate.x, candidate.y) <= graphNodeVisualRadius(candidate, options, view.scale) + 4 / view.scale
      ) {
        state.id = candidate.id;
        state.releaseAt = 0;
        return candidate.id;
      }
    }
  }

  const containsFocusedNode = state.id
    ? (Array.isArray(nodes) ? nodes.some((node) => node.id === state.id) : nodes.has(state.id))
    : false;
  if (!state.id || !containsFocusedNode) {
    state.id = null;
    state.releaseAt = 0;
    return null;
  }

  if (state.releaseAt === 0) {
    state.releaseAt = now + graphHoverReleaseDelayMs;
  }
  if (now <= state.releaseAt) {
    return state.id;
  }

  state.id = null;
  state.releaseAt = 0;
  return null;
}

export function stepGraphHighlightState(
  state: GraphHighlightState,
  targetId: string | null,
  rate = graphHighlightTransitionRate
): GraphHighlightState {
  if (targetId && state.id !== targetId) {
    state.id = targetId;
  }

  const targetStrength = targetId ? 1 : 0;
  state.strength += (targetStrength - state.strength) * rate;

  if (!targetId && state.strength < graphHighlightMinimumStrength) {
    state.id = null;
    state.strength = 0;
  }

  return {
    id: state.id,
    strength: state.strength
  };
}

export function clampGraphScale(scale: number): number {
  return clamp(scale, graphMinScale, graphMaxScale);
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
