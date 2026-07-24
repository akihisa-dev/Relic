import {
  graphCategoryColor,
  graphNodeColor,
  graphThemeIsDark,
  type GraphDrawTheme
} from "../graph/graphThemeModel";
import {
  clamp,
  bubbleLabelOpacity,
  bubbleLinkScaleOpacity,
  bubbleNodeScale,
  bubbleNodeVisualRadius,
  type BubbleHighlightState
} from "./bubbleInteractionModel";
import {
  bubbleCategoryContour,
  bubbleCategoryDynamicLayouts,
  bubbleCategoryRegions
} from "./bubbleCategoryModel";
import type { BubbleCategoryPoint } from "./bubbleCategoryModel";
import type {
  BubbleLinkEndpointNode,
  BubbleOptions,
  BubbleSimLink,
  BubbleSimNode
} from "./bubbleTypes";

const bubbleDimmedLinkAlpha = 0.18;
const bubbleDimmedNodeAlpha = 0.34;
const bubbleDimmedLabelAlpha = 0.32;
const bubbleHighlightPulsePeriodMs = 1_700;

export function drawBubble(
  context: CanvasRenderingContext2D,
  nodes: BubbleSimNode[],
  links: BubbleSimLink[],
  view: { panX: number; panY: number; scale: number },
  options: BubbleOptions,
  highlight: BubbleHighlightState,
  theme: GraphDrawTheme,
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

  const animationTimeMs = typeof performance === "undefined" ? 0 : performance.now();
  const highlightProgress = bubbleHighlightProgress(animationTimeMs);
  const highlightOpacity = bubbleHighlightOpacity(animationTimeMs);
  const focusedColor = focused ? theme.accent : null;
  drawBubbleCategoryBubbles(context, nodes, view.scale, theme);
  if (focused && focusedColor) {
    drawBubbleNodeHalo(context, focused, focusedColor, options, view.scale, highlightStrength, highlightOpacity);
  }

  const linkScaleOpacity = bubbleLinkScaleOpacity(view.scale);
  context.save();
  context.setLineDash(bubbleLinkDashPattern(view.scale));
  context.lineCap = "round";
  for (const [index, link] of links.entries()) {
    const endpoints = bubbleLinkEndpoints(link.sourceNode, link.targetNode, options, view.scale);
    if (!endpoints.visible) continue;

    const active = !focused || link.source === focused.id || link.target === focused.id;
    context.globalAlpha = bubbleHighlightAlpha(active, highlightStrength, 0.65, bubbleDimmedLinkAlpha) * linkScaleOpacity;
    context.strokeStyle = active ? theme.borderStrong : theme.border;
    context.lineWidth = Math.max(0.4 / view.scale, options.lineSizeMultiplier * Math.sqrt(link.count) / view.scale);
    context.beginPath();
    context.moveTo(endpoints.sourceX, endpoints.sourceY);
    context.lineTo(endpoints.targetX, endpoints.targetY);
    context.stroke();

    if (focused && focusedColor && active && highlightStrength > 0.05) {
      drawBubbleConnectionPulse(
        context,
        endpoints,
        link.source === focused.id,
        focusedColor,
        view.scale,
        highlightStrength,
        highlightProgress,
        index,
        linkScaleOpacity
      );
    }

    if (options.showArrows && linkScaleOpacity > 0.001) {
      drawArrow(context, link.sourceNode, link.targetNode, options, view.scale);
    }
  }
  context.restore();

  context.globalAlpha = 1;
  for (const node of nodes) {
    const active = !focused || node.id === focused.id || neighbors.has(node.id);
    const radius = bubbleNodeVisualRadius(node, options, view.scale);
    const color = graphNodeColor(node, theme);
    const nodeAlpha = bubbleHighlightAlpha(active, highlightStrength, 1, bubbleDimmedNodeAlpha);
    drawBubbleBubbleNode(context, node, radius, color, theme, view.scale, nodeAlpha);

    if (node.id === focused?.id && highlightStrength > 0) {
      context.globalAlpha = 0.36 * highlightStrength;
      context.fillStyle = theme.primary;
      context.beginPath();
      context.arc(node.x, node.y, radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = highlightStrength;
      context.strokeStyle = focusedColor ?? theme.primary;
      context.lineWidth = 2 / view.scale;
      context.beginPath();
      context.arc(node.x, node.y, radius + Math.max(2, 5 / view.scale), 0, Math.PI * 2);
      context.stroke();
    }

    const labelAlpha = bubbleLabelOpacity(view.scale, options.textFadeMultiplier);
    if (labelAlpha > 0.02) {
      context.globalAlpha = bubbleHighlightAlpha(active, highlightStrength, 1, bubbleDimmedLabelAlpha) * labelAlpha;
      context.fillStyle = theme.text;
      const labelScale = node.id === focused?.id && view.scale < 1 ? 1 / view.scale : bubbleNodeScale(view.scale);
      context.font = `${Math.max(10 / view.scale, 13 * labelScale)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(node.label, node.x, node.y + radius + 4 / view.scale, 240 / view.scale);
    }
  }
  context.restore();
}

export function bubbleNodeBubbleHighlight(theme: GraphDrawTheme): string {
  return graphThemeIsDark(theme.background) ? theme.text : theme.background;
}

function drawBubbleBubbleNode(
  context: CanvasRenderingContext2D,
  node: BubbleSimNode,
  radius: number,
  color: string,
  theme: GraphDrawTheme,
  scale: number,
  alpha: number
): void {
  const highlight = bubbleNodeBubbleHighlight(theme);
  context.save();
  context.globalAlpha = alpha * 0.8;
  context.fillStyle = color;
  context.beginPath();
  context.arc(node.x, node.y, radius, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = alpha * 0.16;
  context.fillStyle = highlight;
  context.beginPath();
  context.arc(
    node.x - radius * 0.28,
    node.y - radius * 0.3,
    radius * 0.48,
    0,
    Math.PI * 2
  );
  context.fill();

  context.globalAlpha = alpha * 0.12;
  context.fillStyle = theme.borderStrong;
  context.beginPath();
  context.arc(
    node.x + radius * 0.2,
    node.y + radius * 0.24,
    radius * 0.42,
    0,
    Math.PI * 2
  );
  context.fill();

  context.globalAlpha = alpha * 0.68;
  context.strokeStyle = color;
  context.lineWidth = 1.2 / scale;
  context.stroke();

  context.globalAlpha = alpha * 0.48;
  context.strokeStyle = highlight;
  context.lineWidth = 1.1 / scale;
  context.beginPath();
  context.arc(
    node.x,
    node.y,
    radius * 0.68,
    Math.PI * 1.08,
    Math.PI * 1.47
  );
  context.stroke();
  context.restore();
}

export function bubbleHighlightProgress(timeMs: number): number {
  return (timeMs % bubbleHighlightPulsePeriodMs) / bubbleHighlightPulsePeriodMs;
}

export function bubbleHighlightOpacity(timeMs: number): number {
  return 0.5 + Math.sin(bubbleHighlightProgress(timeMs) * Math.PI * 2) * 0.5;
}

function drawBubbleNodeHalo(
  context: CanvasRenderingContext2D,
  node: BubbleSimNode,
  color: string,
  options: BubbleOptions,
  scale: number,
  strength: number,
  opacity: number
): void {
  const radius = bubbleNodeVisualRadius(node, options, scale);
  const outerRadius = radius + (10 + opacity * 6) / scale;
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
  context.globalAlpha = (0.11 + opacity * 0.07) * strength;
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(node.x, node.y, outerRadius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBubbleConnectionPulse(
  context: CanvasRenderingContext2D,
  endpoints: ReturnType<typeof bubbleLinkEndpoints>,
  sourceIsFocused: boolean,
  color: string,
  scale: number,
  strength: number,
  progress: number,
  linkIndex: number,
  linkOpacity: number
): void {
  const point = bubbleConnectionPulsePoint(endpoints, sourceIsFocused, progress, linkIndex);
  const radius = Math.max(1.4 / scale, 2.4 / scale);

  context.save();
  context.globalAlpha = 0.62 * strength * linkOpacity;
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function bubbleConnectionPulsePoint(
  endpoints: ReturnType<typeof bubbleLinkEndpoints>,
  sourceIsFocused: boolean,
  progress: number,
  linkIndex: number
): { x: number; y: number } {
  const linkProgress = (progress + linkIndex * 0.19) % 1;
  const fromX = sourceIsFocused ? endpoints.sourceX : endpoints.targetX;
  const fromY = sourceIsFocused ? endpoints.sourceY : endpoints.targetY;
  const toX = sourceIsFocused ? endpoints.targetX : endpoints.sourceX;
  const toY = sourceIsFocused ? endpoints.targetY : endpoints.sourceY;
  return {
    x: fromX + (toX - fromX) * linkProgress,
    y: fromY + (toY - fromY) * linkProgress
  };
}

export function bubbleLinkDashPattern(scale: number): [number, number] {
  return [1.5 / scale, 5 / scale];
}

export function bubbleLinkEndpoints(
  source: BubbleLinkEndpointNode,
  target: BubbleLinkEndpointNode,
  options: BubbleOptions,
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
  const sourceRadius = bubbleNodeVisualRadius(source, options, scale);
  const targetRadius = bubbleNodeVisualRadius(target, options, scale);

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

export function drawArrow(context: CanvasRenderingContext2D, source: BubbleSimNode, target: BubbleSimNode, options: BubbleOptions, scale = 1): void {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const radius = bubbleNodeVisualRadius(target, options, scale) + 3 / scale;
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

export interface BubbleCategoryBubble {
  category: string;
  points: BubbleCategoryPoint[];
  radius: number;
  x: number;
  y: number;
}

export function bubbleCategoryBubbles(nodes: BubbleSimNode[]): BubbleCategoryBubble[] {
  const regions = bubbleCategoryRegions(bubbleCategoryDynamicLayouts(nodes), nodes);
  return [...regions.values()].map((region) => ({
    category: region.category,
    points: bubbleCategoryContour(region),
    radius: region.radius,
    x: region.x,
    y: region.y
  }));
}

export function bubbleCategoryAtWorldPoint(
  nodes: BubbleSimNode[],
  point: BubbleCategoryPoint
): string | null {
  const bubbles = bubbleCategoryBubbles(nodes);
  for (let index = bubbles.length - 1; index >= 0; index -= 1) {
    const bubble = bubbles[index]!;
    if (pointInPolygon(point, bubble.points)) return bubble.category;
  }
  return null;
}

function drawBubbleCategoryBubbles(
  context: CanvasRenderingContext2D,
  nodes: BubbleSimNode[],
  scale: number,
  theme: GraphDrawTheme
): void {
  for (const bubble of bubbleCategoryBubbles(nodes)) {
    const color = graphCategoryColor(bubble.category, theme);
    context.save();
    context.fillStyle = color;
    context.globalAlpha = 0.075;
    traceSmoothBubble(context, bubble.points);
    context.fill();

    context.globalAlpha = 0.46;
    context.strokeStyle = color;
    context.lineWidth = 1.4 / scale;
    context.stroke();

    context.globalAlpha = 0.92;
    context.fillStyle = color;
    context.font = `650 ${13 / scale}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(
      bubble.category,
      bubble.x,
      Math.min(...bubble.points.map((point) => point.y)) + 12 / scale,
      Math.max(80 / scale, bubble.radius * 1.5)
    );
    context.restore();
  }
}

function traceSmoothBubble(
  context: CanvasRenderingContext2D,
  points: readonly BubbleCategoryPoint[]
): void {
  if (points.length === 0) return;
  const last = points.at(-1)!;
  const first = points[0]!;
  context.beginPath();
  context.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index]!;
    const next = points[(index + 1) % points.length]!;
    context.quadraticCurveTo(
      point.x,
      point.y,
      (point.x + next.x) / 2,
      (point.y + next.y) / 2
    );
  }
  context.closePath();
}

function pointInPolygon(
  point: BubbleCategoryPoint,
  polygon: readonly BubbleCategoryPoint[]
): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < (
        (previousPoint.x - currentPoint.x) *
        (point.y - currentPoint.y) /
        (previousPoint.y - currentPoint.y) +
        currentPoint.x
      );
    if (crosses) inside = !inside;
  }
  return inside;
}

export function bubbleHighlightAlpha(
  active: boolean,
  strength: number,
  normalAlpha: number,
  dimmedAlpha: number
): number {
  return normalAlpha + ((active ? normalAlpha : dimmedAlpha) - normalAlpha) * clamp(strength, 0, 1);
}
