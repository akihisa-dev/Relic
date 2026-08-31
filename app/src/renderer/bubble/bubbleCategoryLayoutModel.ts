import {
  bubbleCategoryGroupKey,
  bubbleCategorySpacing,
  type BubbleCategoryForceNode,
  type BubbleCategoryLayout,
  type BubbleCategoryNode,
  type BubbleCategoryPoint
} from "./bubbleCategoryCore";

const bubbleCategoryMinimumRadius = 96;
const bubbleCategoryNodeSpacing = 48;
const bubbleCategoryClusterClearance = 120;
export const bubbleCategoryBoundaryPadding = 36;

export function bubbleCategoryRadius(nodeCount: number): number {
  return Math.max(
    bubbleCategoryMinimumRadius,
    Math.sqrt(Math.max(1, nodeCount)) * bubbleCategoryNodeSpacing
  );
}

export function bubbleCategoryLayouts(nodes: Iterable<BubbleCategoryNode>): BubbleCategoryLayout[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const category = bubbleCategoryGroupKey(node.category);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const categories = [...counts.keys()].toSorted((left, right) => left.localeCompare(right, "ja"));
  if (categories.length === 0) return [];

  const radii = categories.map((category) => bubbleCategoryRadius(counts.get(category) ?? 0));
  const maximumRadius = Math.max(...radii);
  const ringRadius = categories.length === 1
    ? maximumRadius + 180
    : (maximumRadius + bubbleCategorySpacing / 2) /
      Math.sin(Math.PI / categories.length);
  const clusterX = categories.length === 1
    ? 0
    : ringRadius + maximumRadius + bubbleCategoryClusterClearance;

  return categories.map((category, index) => {
    const angle = categories.length === 1
      ? 0
      : -Math.PI / 2 + index * Math.PI * 2 / categories.length;
    return {
      category,
      count: counts.get(category) ?? 0,
      radius: radii[index]!,
      x: clusterX + Math.cos(angle) * ringRadius,
      y: Math.sin(angle) * ringRadius
    };
  });
}

export function bubbleCategoryDynamicLayouts(
  nodes: Iterable<BubbleCategoryForceNode>
): BubbleCategoryLayout[] {
  const groups = new Map<string, {
    count: number;
    singleNode: BubbleCategoryForceNode;
    sumX: number;
    sumY: number;
  }>();
  for (const node of nodes) {
    const category = bubbleCategoryGroupKey(node.category);
    if (node.x === undefined || node.y === undefined) continue;
    const group = groups.get(category) ?? {
      count: 0,
      singleNode: node,
      sumX: 0,
      sumY: 0
    };
    group.count += 1;
    group.singleNode = node;
    group.sumX += node.x;
    group.sumY += node.y;
    groups.set(category, group);
  }

  return [...groups.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right, "ja"))
    .map(([category, group]) => {
      const useSingletonCenter = group.count === 1;
      return {
        category,
        count: group.count,
        radius: bubbleCategoryRadius(group.count),
        x: group.sumX / group.count +
          (useSingletonCenter ? group.singleNode.categoryCenterOffsetX ?? 0 : 0),
        y: group.sumY / group.count +
          (useSingletonCenter ? group.singleNode.categoryCenterOffsetY ?? 0 : 0)
      };
    });
}

export function bubbleCategoryCenterOffsetForNodeDrag(
  node: BubbleCategoryForceNode,
  layouts: Iterable<BubbleCategoryLayout>,
  point: BubbleCategoryPoint,
  padding = bubbleCategoryBoundaryPadding
): BubbleCategoryPoint | null {
  const category = bubbleCategoryGroupKey(node.category);
  const layout = [...layouts].find((candidate) => candidate.category === category);
  if (!layout || layout.count !== 1) return null;
  const dx = point.x - layout.x;
  const dy = point.y - layout.y;
  const distance = Math.hypot(dx, dy);
  const maximumDistance = Math.max(0, layout.radius - Math.max(0, padding));
  if (distance > maximumDistance && distance > 0) {
    return {
      x: -dx / distance * maximumDistance,
      y: -dy / distance * maximumDistance
    };
  }
  return {
    x: layout.x - point.x,
    y: layout.y - point.y
  };
}
