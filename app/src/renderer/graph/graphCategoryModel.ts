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
export const graphCategoryDriftCenterStrength = 0.012;

const graphCategoryMinimumRadius = 96;
const graphCategoryNodeSpacing = 48;
const graphCategoryDesiredOverlap = 28;
const graphCategoryClusterClearance = 120;
const graphCategoryBoundaryPadding = 36;
const graphCategoryCollisionStrength = 0.16;

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

export function graphCategoryDynamicLayouts(
  nodes: Iterable<GraphCategoryForceNode>
): GraphCategoryLayout[] {
  const groups = new Map<string, {
    count: number;
    sumX: number;
    sumY: number;
  }>();
  for (const node of nodes) {
    const category = normalizeGraphCategory(node.category);
    if (!category || node.x === undefined || node.y === undefined) continue;
    const group = groups.get(category) ?? { count: 0, sumX: 0, sumY: 0 };
    group.count += 1;
    group.sumX += node.x;
    group.sumY += node.y;
    groups.set(category, group);
  }

  return [...groups.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right, "ja"))
    .map(([category, group]) => ({
      category,
      count: group.count,
      radius: graphCategoryRadius(group.count),
      x: group.sumX / group.count,
      y: group.sumY / group.count
    }));
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
      contact.radius
    ) / 2;
    const planeRadius = contactDistance / directionProjection;
    if (planeRadius >= boundaryRadius) continue;

    boundaryRadius = Math.min(boundaryRadius, Math.max(0, planeRadius));
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

export function applyGraphCategoryMotion(
  nodes: Iterable<GraphCategoryForceNode>,
  alpha: number
): Map<string, GraphCategoryRegion> {
  const orderedNodes = [...nodes];
  const regions = graphCategoryRegions(graphCategoryDynamicLayouts(orderedNodes));
  const nodesByCategory = new Map<string, GraphCategoryForceNode[]>();
  for (const node of orderedNodes) {
    const category = normalizeGraphCategory(node.category);
    if (!category) continue;
    const categoryNodes = nodesByCategory.get(category) ?? [];
    categoryNodes.push(node);
    nodesByCategory.set(category, categoryNodes);
  }

  const orderedRegions = [...regions.values()];
  for (let leftIndex = 0; leftIndex < orderedRegions.length; leftIndex += 1) {
    const left = orderedRegions[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < orderedRegions.length; rightIndex += 1) {
      const right = orderedRegions[rightIndex]!;
      const dx = right.x - left.x;
      const dy = right.y - left.y;
      const distance = Math.hypot(dx, dy);
      const minimumDistance = left.radius + right.radius - graphCategoryDesiredOverlap;
      if (distance >= minimumDistance) continue;

      const fallbackAngle = (leftIndex + rightIndex * 0.5) * Math.PI * 2 /
        Math.max(2, orderedRegions.length);
      const unitX = distance === 0 ? Math.cos(fallbackAngle) : dx / distance;
      const unitY = distance === 0 ? Math.sin(fallbackAngle) : dy / distance;
      const correction = (
        (minimumDistance - distance) *
        graphCategoryCollisionStrength *
        Math.max(0, alpha)
      );
      shiftCategoryVelocity(nodesByCategory.get(left.category), -unitX * correction, -unitY * correction);
      shiftCategoryVelocity(nodesByCategory.get(right.category), unitX * correction, unitY * correction);
    }
  }

  for (const node of orderedNodes) {
    const region = graphCategoryTarget(node, regions);
    if (!region || node.x === undefined || node.y === undefined) continue;
    node.vx = (node.vx ?? 0) +
      (region.x - node.x) * graphCategoryAttractionStrength * Math.max(0, alpha);
    node.vy = (node.vy ?? 0) +
      (region.y - node.y) * graphCategoryAttractionStrength * Math.max(0, alpha);
  }
  applyGraphCategoryBoundary(orderedNodes, regions, alpha);
  return regions;
}

export function translateGraphCategoryNodes<T extends GraphCategoryForceNode>(
  nodes: Iterable<T>,
  category: string,
  dx: number,
  dy: number
): T[] {
  const normalizedCategory = normalizeGraphCategory(category);
  if (!normalizedCategory) return [];

  const translated: T[] = [];
  for (const node of nodes) {
    if (normalizeGraphCategory(node.category) !== normalizedCategory ||
        node.x === undefined || node.y === undefined) continue;
    node.x += dx;
    node.y += dy;
    if ("fx" in node) {
      const fixedNode = node as T & { fx?: number | null; fy?: number | null };
      fixedNode.fx = node.x;
      fixedNode.fy = node.y;
    }
    translated.push(node);
  }
  return translated;
}

export function constrainGraphCategoryTranslation(
  nodes: Iterable<GraphCategoryForceNode>,
  category: string,
  dx: number,
  dy: number
): GraphCategoryPoint {
  const layouts = graphCategoryDynamicLayouts(nodes);
  const target = layouts.find((layout) => layout.category === normalizeGraphCategory(category));
  if (!target) return { x: dx, y: dy };

  let nextX = target.x + dx;
  let nextY = target.y + dy;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const other of layouts) {
      if (other.category === target.category) continue;
      const offsetX = nextX - other.x;
      const offsetY = nextY - other.y;
      const distance = Math.hypot(offsetX, offsetY);
      const minimumDistance = target.radius + other.radius - graphCategoryDesiredOverlap;
      if (distance >= minimumDistance) continue;

      const fallbackAngle = stableCategoryAngle(target.category, other.category);
      const unitX = distance === 0 ? Math.cos(fallbackAngle) : offsetX / distance;
      const unitY = distance === 0 ? Math.sin(fallbackAngle) : offsetY / distance;
      nextX = other.x + unitX * minimumDistance;
      nextY = other.y + unitY * minimumDistance;
    }
  }
  return { x: nextX - target.x, y: nextY - target.y };
}

function shiftCategoryVelocity(
  nodes: GraphCategoryForceNode[] | undefined,
  dx: number,
  dy: number
): void {
  for (const node of nodes ?? []) {
    node.vx = (node.vx ?? 0) + dx;
    node.vy = (node.vy ?? 0) + dy;
  }
}

function stableCategoryAngle(left: string, right: string): number {
  let hash = 0;
  for (const character of `${left}\u0000${right}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 1_677_761);
  }
  return (Math.abs(hash) % 360) * Math.PI / 180;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
