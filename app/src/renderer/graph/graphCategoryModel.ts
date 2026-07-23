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

export interface GraphCategoryContact {
  angle: number;
  distance: number;
  radius: number;
}

export interface GraphCategoryRegion extends GraphCategoryLayout {
  contacts: GraphCategoryContact[];
}

export interface GraphCategoryPoint {
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
const graphCategoryDesiredOverlap = 28;
const graphCategoryContactGap = 8;
const graphCategoryClusterClearance = 120;
const graphCategoryBoundaryPadding = 36;

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
    : (maximumRadius - graphCategoryDesiredOverlap / 2) /
      Math.sin(Math.PI / categories.length);
  const clusterX = categories.length === 1
    ? 0
    : ringRadius + maximumRadius + graphCategoryClusterClearance;

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

export function graphCategoryRegions(
  layouts: Iterable<GraphCategoryLayout>
): Map<string, GraphCategoryRegion> {
  const ordered = [...layouts];
  return new Map(ordered.map((layout) => {
    const contacts = ordered.flatMap((other): GraphCategoryContact[] => {
      if (other.category === layout.category) return [];
      const dx = other.x - layout.x;
      const dy = other.y - layout.y;
      const distance = Math.hypot(dx, dy);
      if (distance >= layout.radius + other.radius) return [];
      return [{
        angle: Math.atan2(dy, dx),
        distance,
        radius: other.radius
      }];
    });
    return [layout.category, { ...layout, contacts }];
  }));
}

export function graphCategoryTarget<T extends GraphCategoryLayout>(
  node: GraphCategoryNode,
  layouts: ReadonlyMap<string, T>
): T | null {
  const category = normalizeGraphCategory(node.category);
  return category ? layouts.get(category) ?? null : null;
}

export function graphCategoryBoundaryRadius(
  region: GraphCategoryRegion,
  angle: number
): number {
  let boundaryRadius = region.radius;
  for (const contact of region.contacts) {
    const delta = normalizeAngle(angle - contact.angle);
    const directionProjection = Math.cos(delta);
    if (directionProjection <= 0) continue;

    const contactDistance = (
      contact.distance +
      region.radius -
      contact.radius -
      graphCategoryContactGap
    ) / 2;
    const planeRadius = contactDistance / directionProjection;
    if (planeRadius >= boundaryRadius) continue;

    const contactHalfAngle = Math.acos(clamp(contactDistance / region.radius, -1, 1));
    const contactProgress = clamp(
      1 - Math.abs(delta) / Math.max(0.001, contactHalfAngle),
      0,
      1
    );
    const smoothContact = contactProgress * contactProgress * (3 - 2 * contactProgress);
    const overlap = region.radius + contact.radius - contact.distance;
    const indentation = Math.min(12, overlap * 0.18) * smoothContact;
    boundaryRadius = Math.min(boundaryRadius, Math.max(0, planeRadius - indentation));
  }
  return boundaryRadius;
}

export function graphCategoryContour(
  region: GraphCategoryRegion,
  pointCount = 72
): GraphCategoryPoint[] {
  const count = Math.max(12, Math.floor(pointCount));
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    const radius = graphCategoryBoundaryRadius(region, angle);
    return {
      x: region.x + Math.cos(angle) * radius,
      y: region.y + Math.sin(angle) * radius
    };
  });
}

export function constrainGraphCategoryPoint(
  node: GraphCategoryNode,
  regions: ReadonlyMap<string, GraphCategoryRegion>,
  point: GraphCategoryPoint,
  padding = graphCategoryBoundaryPadding
): GraphCategoryPoint {
  const region = graphCategoryTarget(node, regions);
  if (!region) return point;

  const dx = point.x - region.x;
  const dy = point.y - region.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return point;

  const angle = Math.atan2(dy, dx);
  const maximumDistance = Math.max(
    0,
    graphCategoryBoundaryRadius(region, angle) - Math.max(0, padding)
  );
  if (distance <= maximumDistance) return point;
  return {
    x: region.x + dx / distance * maximumDistance,
    y: region.y + dy / distance * maximumDistance
  };
}

export function applyGraphCategoryBoundary(
  nodes: Iterable<GraphCategoryForceNode>,
  regions: ReadonlyMap<string, GraphCategoryRegion>,
  _alpha: number
): void {
  for (const node of nodes) {
    if (node.x === undefined || node.y === undefined) continue;
    const predicted = {
      x: node.x + (node.vx ?? 0),
      y: node.y + (node.vy ?? 0)
    };
    const constrained = constrainGraphCategoryPoint(node, regions, predicted);
    node.vx = constrained.x - node.x;
    node.vy = constrained.y - node.y;
  }
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
