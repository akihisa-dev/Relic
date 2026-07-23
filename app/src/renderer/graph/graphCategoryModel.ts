export interface GraphCategoryNode {
  category?: string | null;
}

export interface GraphCategoryLayout {
  category: string;
  count: number;
  radius: number;
  x: number;
  y: number;
}

export interface GraphCategoryForceNode extends GraphCategoryNode {
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

export const graphCategoryAttractionStrength = 0.22;

const graphCategoryMinimumRadius = 96;
const graphCategoryNodeSpacing = 48;
const graphCategoryGap = 72;
const graphCategoryBoundaryPadding = 36;
const graphCategoryBoundaryStrength = 0.42;

export function normalizeGraphCategory(category: unknown): string | null {
  if (typeof category !== "string") return null;
  const normalized = category.trim();
  return normalized || null;
}

export function graphCategoryRadius(nodeCount: number): number {
  return Math.max(
    graphCategoryMinimumRadius,
    Math.sqrt(Math.max(1, nodeCount)) * graphCategoryNodeSpacing
  );
}

export function graphCategoryLayouts(nodes: Iterable<GraphCategoryNode>): GraphCategoryLayout[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const category = normalizeGraphCategory(node.category);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const categories = [...counts.keys()].toSorted((left, right) => left.localeCompare(right, "ja"));
  if (categories.length === 0) return [];

  const radii = categories.map((category) => graphCategoryRadius(counts.get(category) ?? 0));
  const maximumRadius = Math.max(...radii);
  const ringRadius = categories.length === 1
    ? maximumRadius + 180
    : Math.max(
      260,
      (maximumRadius + graphCategoryGap) / Math.sin(Math.PI / categories.length)
    );

  return categories.map((category, index) => {
    const angle = categories.length === 1
      ? 0
      : -Math.PI / 2 + index * Math.PI * 2 / categories.length;
    return {
      category,
      count: counts.get(category) ?? 0,
      radius: radii[index]!,
      x: Math.cos(angle) * ringRadius,
      y: Math.sin(angle) * ringRadius
    };
  });
}

export function graphCategoryTarget(
  node: GraphCategoryNode,
  layouts: ReadonlyMap<string, GraphCategoryLayout>
): GraphCategoryLayout | null {
  const category = normalizeGraphCategory(node.category);
  return category ? layouts.get(category) ?? null : null;
}

export function applyGraphCategoryBoundary(
  nodes: Iterable<GraphCategoryForceNode>,
  layouts: ReadonlyMap<string, GraphCategoryLayout>,
  alpha: number
): void {
  for (const node of nodes) {
    const target = graphCategoryTarget(node, layouts);
    if (!target || node.x === undefined || node.y === undefined) continue;

    const dx = node.x - target.x;
    const dy = node.y - target.y;
    const distance = Math.hypot(dx, dy);
    const maximumDistance = Math.max(
      graphCategoryMinimumRadius / 2,
      target.radius - graphCategoryBoundaryPadding
    );
    if (distance <= maximumDistance || distance === 0) continue;

    const correction = (
      (distance - maximumDistance) *
      graphCategoryBoundaryStrength *
      Math.max(0, alpha)
    );
    node.vx = (node.vx ?? 0) - dx / distance * correction;
    node.vy = (node.vy ?? 0) - dy / distance * correction;
  }
}
