import type React from "react";

import type { WorkspaceGraphLink, WorkspaceGraphNode } from "../../shared/ipc";
import {
  graphNodeBaseRadiusFromWeight,
  graphNodeWeight,
  graphSimulationLinks,
  graphSimulationNodes,
  resetGraphTimelapsePositions
} from "./graphLayout";
import type { GraphSimulationClient } from "./graphSimulationClient";
import type {
  GraphColorGroup,
  GraphKeyboardState,
  GraphLinkEndpointNode,
  GraphNodePrimaryAction,
  GraphOptions,
  GraphSimLink,
  GraphSimNode,
  GraphViewTransform
} from "./graphTypes";
import { cssVar } from "./graphViewRuntime";

const graphMinScale = 1 / 128;
const graphMaxScale = 8;
const graphNodeClickMovementThresholdSq = 25;
const graphHoverReleaseDelayMs = 140;
const graphHighlightTransitionRate = 0.2;
const graphHighlightMinimumStrength = 0.01;
const graphDimmedLinkAlpha = 0.18;
const graphDimmedNodeAlpha = 0.34;
const graphDimmedLabelAlpha = 0.32;
const graphHighlightPulsePeriodMs = 1_700;

export interface GraphHoverFocusState {
  id: string | null;
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

export function moveGraphColorGroup(
  groups: GraphColorGroup[],
  draggingGroupId: string,
  targetGroupId: string
): GraphColorGroup[] {
  if (draggingGroupId === targetGroupId) return groups;

  const from = groups.findIndex((group) => group.id === draggingGroupId);
  const to = groups.findIndex((group) => group.id === targetGroupId);
  if (from < 0 || to < 0) return groups;

  const next = [...groups];
  const [moved] = next.splice(from, 1);
  if (!moved) return groups;
  next.splice(to, 0, moved);

  return next;
}

export function drawGraph(
  context: CanvasRenderingContext2D,
  nodes: GraphSimNode[],
  links: GraphSimLink[],
  view: { panX: number; panY: number; scale: number },
  options: GraphOptions,
  colorGroups: GraphColorGroup[],
  tagsByNode: Map<string, string[]>,
  highlight: GraphHighlightState,
  width: number,
  height: number
): void {
  context.save();
  context.translate(view.panX + width / 2, view.panY + height / 2);
  context.scale(view.scale, view.scale);

  const highlightStrength = clamp(highlight.strength, 0, 1);
  const focused = highlight.id && highlightStrength > 0 ? nodes.find((node) => node.id === highlight.id) ?? null : null;
  const neighbors = new Set<string>();
  if (focused) {
    for (const link of links) {
      if (link.source === focused.id) neighbors.add(link.target);
      if (link.target === focused.id) neighbors.add(link.source);
    }
  }

  const highlightPulse = graphHighlightPulse(typeof performance === "undefined" ? 0 : performance.now());
  const focusedColor = focused
    ? nodeColor(focused, colorGroups, tagsByNode.get(focused.id) ?? [])
    : null;
  if (focused && focusedColor) {
    drawGraphNodeHalo(context, focused, focusedColor, options, view.scale, highlightStrength, highlightPulse);
  }

  const linkScaleOpacity = graphLinkScaleOpacity(view.scale);
  for (const [index, link] of links.entries()) {
    const endpoints = graphLinkEndpoints(link.sourceNode, link.targetNode, options, view.scale);
    if (!endpoints.visible) continue;

    const active = !focused || link.source === focused.id || link.target === focused.id;
    context.globalAlpha = graphHighlightAlpha(active, highlightStrength, 0.65, graphDimmedLinkAlpha) * linkScaleOpacity;
    context.strokeStyle = active ? cssVar("--color-border-strong", "#5b5d52") : cssVar("--color-border", "#3b3c33");
    context.lineWidth = Math.max(0.4 / view.scale, options.lineSizeMultiplier * Math.sqrt(link.count) / view.scale);
    context.beginPath();
    context.moveTo(endpoints.sourceX, endpoints.sourceY);
    context.lineTo(endpoints.targetX, endpoints.targetY);
    context.stroke();

    if (focused && focusedColor && active && highlightStrength > 0.05) {
      drawGraphConnectionPulse(
        context,
        endpoints,
        link.source === focused.id,
        focusedColor,
        view.scale,
        highlightStrength,
        highlightPulse,
        index,
        linkScaleOpacity
      );
    }

    if (options.showArrows && linkScaleOpacity > 0.001) {
      drawArrow(context, link.sourceNode, link.targetNode, options, view.scale);
    }
  }

  context.globalAlpha = 1;
  for (const node of nodes) {
    const active = !focused || node.id === focused.id || neighbors.has(node.id);
    const radius = graphNodeVisualRadius(node, options, view.scale);
    const color = nodeColor(node, colorGroups, tagsByNode.get(node.id) ?? []);
    context.globalAlpha = graphHighlightAlpha(active, highlightStrength, 1, graphDimmedNodeAlpha);
    context.fillStyle = color;
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fill();

    if (node.id === focused?.id && highlightStrength > 0) {
      context.globalAlpha = 0.36 * highlightStrength;
      context.fillStyle = cssVar("--color-primary", "#1a1b17");
      context.beginPath();
      context.arc(node.x, node.y, radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = highlightStrength;
      context.strokeStyle = cssVar("--color-primary", "#1a1b17");
      context.lineWidth = 2 / view.scale;
      context.beginPath();
      context.arc(node.x, node.y, radius + Math.max(2, 5 / view.scale), 0, Math.PI * 2);
      context.stroke();
    }

    const labelAlpha = graphLabelOpacity(view.scale, options.textFadeMultiplier);
    if (labelAlpha > 0.02) {
      context.globalAlpha = graphHighlightAlpha(active, highlightStrength, 1, graphDimmedLabelAlpha) * labelAlpha;
      context.fillStyle = cssVar("--color-text", "#1e1e1e");
      const labelScale = node.id === focused?.id && view.scale < 1 ? 1 / view.scale : graphNodeScale(view.scale);
      context.font = `${Math.max(10 / view.scale, 13 * labelScale)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(node.label, node.x, node.y + radius + 4 / view.scale, 240 / view.scale);
    }
  }
  context.restore();
}

export function graphHighlightPulse(timeMs: number): number {
  const phase = (timeMs % graphHighlightPulsePeriodMs) / graphHighlightPulsePeriodMs;
  return 0.5 + Math.sin(phase * Math.PI * 2) * 0.5;
}

function drawGraphNodeHalo(
  context: CanvasRenderingContext2D,
  node: GraphSimNode,
  color: string,
  options: GraphOptions,
  scale: number,
  strength: number,
  pulse: number
): void {
  const radius = graphNodeVisualRadius(node, options, scale);
  const outerRadius = radius + (10 + pulse * 6) / scale;
  const gradient = context.createRadialGradient(
    node.x,
    node.y,
    Math.max(0.5, radius * 0.45),
    node.x,
    node.y,
    outerRadius
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.58, color);
  gradient.addColorStop(1, "transparent");

  context.save();
  context.globalAlpha = (0.11 + pulse * 0.07) * strength;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(node.x, node.y, outerRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGraphConnectionPulse(
  context: CanvasRenderingContext2D,
  endpoints: ReturnType<typeof graphLinkEndpoints>,
  sourceIsFocused: boolean,
  color: string,
  scale: number,
  strength: number,
  pulse: number,
  linkIndex: number,
  linkOpacity: number
): void {
  const progress = (pulse + linkIndex * 0.19) % 1;
  const fromX = sourceIsFocused ? endpoints.sourceX : endpoints.targetX;
  const fromY = sourceIsFocused ? endpoints.sourceY : endpoints.targetY;
  const toX = sourceIsFocused ? endpoints.targetX : endpoints.sourceX;
  const toY = sourceIsFocused ? endpoints.targetY : endpoints.sourceY;
  const x = fromX + (toX - fromX) * progress;
  const y = fromY + (toY - fromY) * progress;
  const radius = Math.max(1.4 / scale, 2.4 / scale);

  context.save();
  context.globalAlpha = 0.62 * strength * linkOpacity;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function graphLinkEndpoints(
  source: GraphLinkEndpointNode,
  target: GraphLinkEndpointNode,
  options: GraphOptions,
  scale: number
): {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  visible: boolean;
} {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const sourceRadius = graphNodeVisualRadius(source, options, scale);
  const targetRadius = graphNodeVisualRadius(target, options, scale);

  if (length <= sourceRadius + targetRadius) {
    return {
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      visible: false
    };
  }

  const unitX = dx / length;
  const unitY = dy / length;

  return {
    sourceX: source.x + unitX * sourceRadius,
    sourceY: source.y + unitY * sourceRadius,
    targetX: target.x - unitX * targetRadius,
    targetY: target.y - unitY * targetRadius,
    visible: true
  };
}

export function drawArrow(context: CanvasRenderingContext2D, source: GraphSimNode, target: GraphSimNode, options: GraphOptions, scale = 1): void {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = graphNodeVisualRadius(target, options, scale) + 3 / scale;
  const x = target.x - Math.cos(angle) * radius;
  const y = target.y - Math.sin(angle) * radius;
  const size = 6 / scale;

  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x - Math.cos(angle - 0.45) * size, y - Math.sin(angle - 0.45) * size);
  context.lineTo(x - Math.cos(angle + 0.45) * size, y - Math.sin(angle + 0.45) * size);
  context.closePath();
  context.fillStyle = context.strokeStyle;
  context.fill();
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

export function nodeColor(node: WorkspaceGraphNode, groups: GraphColorGroup[], tags: string[]): string {
  const group = groups.find((candidate) => graphNodeMatchesQuery(node, candidate.query, tags));
  if (group) return group.color;

  if (node.type === "tag") return cssVar("--color-accent", "#f2691b");
  if (node.type === "attachment") return cssVar("--color-text-muted", "#76756c");
  if (node.type === "unresolved") return cssVar("--color-text-muted", "#76756c");

  return cssVar("--color-text-secondary", "#62625b");
}

export function collectGraphNodeTags(
  nodes: WorkspaceGraphNode[],
  links: WorkspaceGraphLink[]
): Map<string, string[]> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const tagsByNode = new Map<string, Set<string>>();

  for (const link of links) {
    if (link.type !== "tag") continue;
    const tagNode = nodeById.get(link.target);
    if (!tagNode || tagNode.type !== "tag") continue;
    const tag = tagNode.label.replace(/^#/, "");
    const tags = tagsByNode.get(link.source) ?? new Set<string>();
    tags.add(tag);
    tagsByNode.set(link.source, tags);
  }

  return new Map([...tagsByNode.entries()].map(([nodeId, tags]) => [
    nodeId,
    [...tags].toSorted((a, b) => a.localeCompare(b, "ja"))
  ]));
}

export function graphNodeMatchesQuery(node: WorkspaceGraphNode, query: string, tags: string[]): boolean {
  const tokens = tokenizeGraphQuery(query);
  if (tokens.length === 0) return true;

  return tokens.every((rawToken) => {
    const negated = rawToken.startsWith("-");
    const token = (negated ? rawToken.slice(1) : rawToken).trim().toLocaleLowerCase();
    if (!token) return true;

    const matches = graphNodeMatchesToken(node, token, tags);
    return negated ? !matches : matches;
  });
}

export function graphNodeMatchesToken(node: WorkspaceGraphNode, token: string, tags: string[]): boolean {
  const separatorIndex = token.indexOf(":");
  if (separatorIndex > 0) {
    const key = token.slice(0, separatorIndex);
    const value = token.slice(separatorIndex + 1);
    if (!value) return false;

    if (key === "path") return (node.path ?? node.id).toLocaleLowerCase().includes(value);
    if (key === "file" || key === "name") return node.label.toLocaleLowerCase().includes(value);
    if (key === "tag") return graphNodeTagSearchText(node, tags).includes(value.replace(/^#/, ""));
    if (key === "type" || key === "is") return node.type.toLocaleLowerCase() === value;
  }

  return graphNodeSearchText(node, tags).includes(token);
}

export function graphNodeSearchText(node: WorkspaceGraphNode, tags: string[]): string {
  return [
    node.label,
    node.path ?? "",
    node.id,
    node.type,
    ...tags.map((tag) => `#${tag}`)
  ].join("\n").toLocaleLowerCase();
}

export function graphNodeTagSearchText(node: WorkspaceGraphNode, tags: string[]): string {
  return [
    node.type === "tag" ? node.label.replace(/^#/, "") : "",
    ...tags
  ].join("\n").toLocaleLowerCase();
}

export function tagSearchQueryFromNode(node: WorkspaceGraphNode): string {
  return node.label.replace(/^#/, "") || node.id.replace(/^#/, "");
}

export function graphNodePrimaryAction(node: WorkspaceGraphNode): GraphNodePrimaryAction | null {
  if (node.path) return { path: node.path, type: "file" };
  if (node.type === "tag") return { tag: tagSearchQueryFromNode(node), type: "tagSearch" };

  return null;
}

export function isGraphNodePrimaryPointerButton(button: number): boolean {
  return button === 0 || button === 1;
}

export function graphPointerMovedBeyondClickThreshold(dx: number, dy: number): boolean {
  return dx * dx + dy * dy > graphNodeClickMovementThresholdSq;
}

export function tokenizeGraphQuery(query: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'|(\S+)/g;

  for (const match of query.matchAll(pattern)) {
    const value = match[1] ?? match[2] ?? match[3] ?? "";
    const token = value.trim();
    if (token) tokens.push(token);
  }

  return tokens;
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
  nodes: GraphSimNode[],
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
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const candidate = nodes[index];
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

  if (!state.id || !nodes.some((node) => node.id === state.id)) {
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

export function graphHighlightAlpha(
  active: boolean,
  strength: number,
  normalAlpha: number,
  dimmedAlpha: number
): number {
  return normalAlpha + ((active ? normalAlpha : dimmedAlpha) - normalAlpha) * clamp(strength, 0, 1);
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
