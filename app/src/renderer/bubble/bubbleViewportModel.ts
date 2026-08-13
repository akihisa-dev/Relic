import {
  bubbleCategoryDynamicLayouts,
  bubbleCategoryRadius
} from "./bubbleCategoryModel";
import { bubbleNodeVisualRadius } from "./bubbleInteractionModel";
import type { BubbleOptions, BubbleSimNode, BubbleViewTransform } from "./bubbleTypes";

export const bubbleViewportPadding = 48;
const bubbleViewportMinimumScale = 1 / 128;

export interface BubbleContentBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

/**
 * Returns the world-space bounds of both file nodes and their category bubbles.
 * The calculation is pure and never writes coordinates back to the graph.
 */
export function bubbleContentBounds(
  nodes: Iterable<BubbleSimNode>,
  options: BubbleOptions
): BubbleContentBounds | null {
  const orderedNodes = [...nodes].filter((node) =>
    Number.isFinite(node.x) && Number.isFinite(node.y)
  );
  if (orderedNodes.length === 0) return null;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const include = (x: number, y: number, radius: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return;
    minX = Math.min(minX, x - radius);
    minY = Math.min(minY, y - radius);
    maxX = Math.max(maxX, x + radius);
    maxY = Math.max(maxY, y + radius);
  };

  for (const node of orderedNodes) {
    include(node.x, node.y, bubbleNodeVisualRadius(node, options, 1));
  }

  for (const layout of bubbleCategoryDynamicLayouts(orderedNodes)) {
    include(layout.x, layout.y, bubbleCategoryRadius(layout.count) + 16);
  }

  return Number.isFinite(minX) && Number.isFinite(minY) &&
    Number.isFinite(maxX) && Number.isFinite(maxY)
    ? { maxX, maxY, minX, minY }
    : null;
}

/**
 * Fits a new graph into the visible canvas while retaining the existing
 * pan/zoom contract for subsequent pointer and wheel interactions.
 */
export function fitBubbleViewToNodes(
  view: BubbleViewTransform,
  nodes: Iterable<BubbleSimNode>,
  options: BubbleOptions,
  width: number,
  height: number,
  padding = bubbleViewportPadding
): void {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 900;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 600;
  const bounds = bubbleContentBounds(nodes, options);
  if (!bounds) {
    view.panX = 0;
    view.panY = 0;
    view.scale = 1;
    view.targetScale = 1;
    view.zoomCenterX = 0;
    view.zoomCenterY = 0;
    return;
  }

  const safePadding = Math.max(0, Math.min(
    Math.min(safeWidth, safeHeight) / 2 - 1,
    Number.isFinite(padding) ? padding : bubbleViewportPadding
  ));
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(
    1,
    (safeWidth - safePadding * 2) / contentWidth,
    (safeHeight - safePadding * 2) / contentHeight
  );
  const nextScale = Number.isFinite(scale) && scale > 0
    ? Math.max(bubbleViewportMinimumScale, scale)
    : 1;
  // Halving before adding avoids overflowing when a single node is near the
  // largest finite coordinate representable by JavaScript numbers.
  const centerX = bounds.minX / 2 + bounds.maxX / 2;
  const centerY = bounds.minY / 2 + bounds.maxY / 2;

  view.scale = nextScale;
  view.targetScale = nextScale;
  view.panX = -centerX * nextScale;
  view.panY = -centerY * nextScale;
  view.zoomCenterX = 0;
  view.zoomCenterY = 0;
}
