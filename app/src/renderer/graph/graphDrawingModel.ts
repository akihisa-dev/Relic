import type { WorkspaceGraphNode } from "../../shared/ipc";
import {
  clamp,
  graphLabelOpacity,
  graphLinkScaleOpacity,
  graphNodeScale,
  graphNodeVisualRadius,
  type GraphHighlightState
} from "./graphInteractionModel";
import { graphNodeMatchesQuery } from "./graphSearchModel";
import type {
  GraphColorGroup,
  GraphLinkEndpointNode,
  GraphOptions,
  GraphSimLink,
  GraphSimNode
} from "./graphTypes";
import { cssVar } from "./graphViewRuntime";

const graphDimmedLinkAlpha = 0.18;
const graphDimmedNodeAlpha = 0.34;
const graphDimmedLabelAlpha = 0.32;
const graphHighlightPulsePeriodMs = 1_700;

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
    ? cssVar("--color-accent", "#f2691b")
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
      context.strokeStyle = focusedColor ?? cssVar("--color-primary", "#1a1b17");
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

export function nodeColor(node: WorkspaceGraphNode, groups: GraphColorGroup[], tags: string[]): string {
  const group = groups.find((candidate) => graphNodeMatchesQuery(node, candidate.query, tags));
  if (group) return group.color;

  if (node.type === "tag") return cssVar("--color-accent", "#f2691b");
  if (node.type === "attachment") return cssVar("--color-text-muted", "#76756c");
  if (node.type === "unresolved") return cssVar("--color-text-muted", "#76756c");

  return cssVar("--color-text-secondary", "#62625b");
}

export function graphHighlightAlpha(
  active: boolean,
  strength: number,
  normalAlpha: number,
  dimmedAlpha: number
): number {
  return normalAlpha + ((active ? normalAlpha : dimmedAlpha) - normalAlpha) * clamp(strength, 0, 1);
}
