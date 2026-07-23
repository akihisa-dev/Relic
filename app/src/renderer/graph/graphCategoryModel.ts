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

export interface GraphCategoryPressure {
  angle: number;
  radius: number;
}

export interface GraphCategoryRegion extends GraphCategoryLayout {
  contacts: GraphCategoryContact[];
  pressures: GraphCategoryPressure[];
}

export interface GraphCategoryPoint {
  x: number;
  y: number;
}

export interface GraphCategoryForceNode extends GraphCategoryNode {
  backlinkCount?: number;
  linkCount?: number;
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
const graphCategoryMaximumBulge = 52;
const graphCategoryPressureHalfAngle = Math.PI / 5;
const graphCategoryTranslationStep = 32;

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
  layouts: Iterable<GraphCategoryLayout>,
  nodes: Iterable<GraphCategoryForceNode> = []
): Map<string, GraphCategoryRegion> {
  const ordered = [...layouts];
  const orderedNodes = [...nodes];
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
    const pressures = orderedNodes.flatMap((node): GraphCategoryPressure[] => {
      if (normalizeGraphCategory(node.category) !== layout.category ||
          node.x === undefined || node.y === undefined) return [];
      const dx = node.x - layout.x;
      const dy = node.y - layout.y;
      const distance = Math.hypot(dx, dy);
      const pressureRadius = Math.min(
        layout.radius + graphCategoryMaximumBulge,
        distance + graphCategoryNodeClearance(node)
      );
      if (pressureRadius <= layout.radius) return [];
      return [{ angle: Math.atan2(dy, dx), radius: pressureRadius }];
    });
    return [layout.category, { ...layout, contacts, pressures }];
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
  for (const pressure of region.pressures) {
    const progress = Math.max(
      0,
      1 - Math.abs(normalizeAngle(angle - pressure.angle)) / graphCategoryPressureHalfAngle
    );
    const smoothPressure = progress * progress * (3 - 2 * progress);
    boundaryRadius = Math.max(
      boundaryRadius,
      region.radius + (pressure.radius - region.radius) * smoothPressure
    );
  }

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
    Math.max(
      graphCategoryBoundaryRadius(region, angle),
      graphCategoryDeformableBoundaryRadius(region, angle)
    ) - Math.max(0, padding)
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
    const constrained = constrainGraphNodeToCategoryRegions(node, regions, predicted);
    node.vx = constrained.x - node.x;
    node.vy = constrained.y - node.y;
  }
}

export function constrainGraphNodeToCategoryRegions(
  node: GraphCategoryForceNode,
  regions: ReadonlyMap<string, GraphCategoryRegion>,
  point: GraphCategoryPoint,
  padding = graphCategoryBoundaryPadding
): GraphCategoryPoint {
  return constrainGraphCategoryExteriorPoint(
    node,
    regions,
    constrainGraphCategoryPoint(node, regions, point, padding)
  );
}

export function applyGraphCategoryMotion(
  nodes: Iterable<GraphCategoryForceNode>,
  alpha: number
): Map<string, GraphCategoryRegion> {
  const orderedNodes = [...nodes];
  const regions = graphCategoryRegions(
    graphCategoryDynamicLayouts(orderedNodes),
    orderedNodes
  );
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

export function translateGraphCategoryNodesWithPush<T extends GraphCategoryForceNode>(
  nodes: Iterable<T>,
  category: string,
  dx: number,
  dy: number
): T[] {
  const orderedNodes = [...nodes];
  const normalizedCategory = normalizeGraphCategory(category);
  if (!normalizedCategory || (dx === 0 && dy === 0)) return [];

  const distance = Math.hypot(dx, dy);
  const stepCount = Math.max(1, Math.ceil(distance / graphCategoryTranslationStep));
  const movedNodes = new Set<T>();
  for (let step = 0; step < stepCount; step += 1) {
    for (const node of translateGraphCategoryStep(
      orderedNodes,
      normalizedCategory,
      dx / stepCount,
      dy / stepCount
    )) {
      movedNodes.add(node);
    }
  }
  return [...movedNodes];
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

function graphCategoryNodeClearance(node: GraphCategoryForceNode): number {
  const weight = Math.max(0, (node.backlinkCount ?? 0) + (node.linkCount ?? 0));
  return Math.max(18, Math.min(36, 3 * Math.sqrt(weight + 1) + 10));
}

function graphCategoryDeformableBoundaryRadius(
  region: GraphCategoryRegion,
  angle: number
): number {
  let radius = region.radius + graphCategoryMaximumBulge;
  for (const contact of region.contacts) {
    const directionProjection = Math.cos(normalizeAngle(angle - contact.angle));
    if (directionProjection <= 0) continue;
    const contactDistance = (
      contact.distance +
      region.radius -
      contact.radius
    ) / 2;
    radius = Math.min(radius, Math.max(0, contactDistance / directionProjection));
  }
  return radius;
}

function constrainGraphCategoryExteriorPoint(
  node: GraphCategoryForceNode,
  regions: ReadonlyMap<string, GraphCategoryRegion>,
  point: GraphCategoryPoint
): GraphCategoryPoint {
  const ownCategory = normalizeGraphCategory(node.category);
  let constrained = point;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const region of regions.values()) {
      if (region.category === ownCategory) continue;
      const dx = constrained.x - region.x;
      const dy = constrained.y - region.y;
      const distance = Math.hypot(dx, dy);
      const fallbackAngle = stableCategoryAngle(ownCategory ?? "uncategorized", region.category);
      const angle = distance === 0 ? fallbackAngle : Math.atan2(dy, dx);
      const minimumDistance = graphCategoryBoundaryRadius(region, angle) +
        graphCategoryNodeClearance(node);
      if (distance >= minimumDistance) continue;
      const unitX = distance === 0 ? Math.cos(angle) : dx / distance;
      const unitY = distance === 0 ? Math.sin(angle) : dy / distance;
      constrained = {
        x: region.x + unitX * minimumDistance,
        y: region.y + unitY * minimumDistance
      };
    }
  }
  return constrained;
}

function translateGraphCategoryStep<T extends GraphCategoryForceNode>(
  nodes: T[],
  category: string,
  dx: number,
  dy: number
): T[] {
  const layouts = graphCategoryDynamicLayouts(nodes);
  const layoutByCategory = new Map(layouts.map((layout) => [layout.category, layout]));
  if (!layoutByCategory.has(category)) return [];

  const translations = new Map<string, GraphCategoryPoint>([
    [category, { x: dx, y: dy }]
  ]);
  const queue = [category];
  const maximumUpdates = Math.max(1, layouts.length * layouts.length);
  let updateCount = 0;

  while (queue.length > 0 && updateCount < maximumUpdates) {
    const movingCategory = queue.shift()!;
    const moving = layoutByCategory.get(movingCategory)!;
    const movingTranslation = translations.get(movingCategory)!;
    const movingX = moving.x + movingTranslation.x;
    const movingY = moving.y + movingTranslation.y;

    for (const other of layouts) {
      if (other.category === movingCategory || other.category === category) continue;
      const otherTranslation = translations.get(other.category) ?? { x: 0, y: 0 };
      const otherX = other.x + otherTranslation.x;
      const otherY = other.y + otherTranslation.y;
      const offsetX = otherX - movingX;
      const offsetY = otherY - movingY;
      const distance = Math.hypot(offsetX, offsetY);
      const minimumDistance = moving.radius + other.radius - graphCategoryDesiredOverlap;
      if (distance >= minimumDistance) continue;

      const movementDistance = Math.hypot(movingTranslation.x, movingTranslation.y);
      const fallbackAngle = movementDistance > 0
        ? Math.atan2(movingTranslation.y, movingTranslation.x)
        : stableCategoryAngle(movingCategory, other.category);
      const unitX = distance === 0 ? Math.cos(fallbackAngle) : offsetX / distance;
      const unitY = distance === 0 ? Math.sin(fallbackAngle) : offsetY / distance;
      translations.set(other.category, {
        x: otherTranslation.x + unitX * (minimumDistance - distance),
        y: otherTranslation.y + unitY * (minimumDistance - distance)
      });
      queue.push(other.category);
      updateCount += 1;
    }
  }

  const moved: T[] = [];
  for (const [movingCategory, translation] of translations) {
    for (const node of translateGraphCategoryNodes(
      nodes,
      movingCategory,
      translation.x,
      translation.y
    )) {
      moved.push(node);
    }
  }
  return moved;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
