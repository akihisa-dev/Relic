import {
  bubbleCategoryAttractionImpulse,
  bubbleCategoryCollisionImpulses,
  bubbleCategoryExteriorImpulse
} from "./bubblePhysicsModel";

export interface BubbleCategoryNode {
  category?: string | null;
}

export interface BubbleCategoryLayout {
  category: string;
  count: number;
  radius: number;
  x: number;
  y: number;
}

export interface BubbleCategoryContact {
  angle: number;
  distance: number;
  radius: number;
}

export interface BubbleCategoryPressure {
  angle: number;
  radius: number;
}

export interface BubbleCategoryObstacle {
  angle: number;
  distance: number;
  radius: number;
}

export interface BubbleCategoryRegion extends BubbleCategoryLayout {
  contacts: BubbleCategoryContact[];
  obstacles: BubbleCategoryObstacle[];
  pressures: BubbleCategoryPressure[];
}

export interface BubbleCategoryPoint {
  x: number;
  y: number;
}

export interface BubbleCategoryForceNode extends BubbleCategoryNode {
  backlinkCount?: number;
  categoryCenterOffsetX?: number;
  categoryCenterOffsetY?: number;
  linkCount?: number;
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

export const bubbleCategoryDriftCenterStrength = 0.012;

const bubbleCategoryMinimumRadius = 96;
const bubbleCategoryNodeSpacing = 48;
const bubbleCategoryDesiredOverlap = 28;
const bubbleCategoryClusterClearance = 120;
const bubbleCategoryBoundaryPadding = 36;
const bubbleCategoryExteriorMaximumIndentationRatio = 0.75;
const bubbleCategoryMaximumBulge = 52;
const bubbleCategoryPressureHalfAngle = Math.PI / 5;
const bubbleCategoryTranslationStep = 32;

export function normalizeBubbleCategory(category: unknown): string | null {
  if (typeof category !== "string") return null;
  const normalized = category.trim();
  return normalized || null;
}

export function bubbleCategoryRadius(nodeCount: number): number {
  return Math.max(
    bubbleCategoryMinimumRadius,
    Math.sqrt(Math.max(1, nodeCount)) * bubbleCategoryNodeSpacing
  );
}

export function bubbleCategoryLayouts(nodes: Iterable<BubbleCategoryNode>): BubbleCategoryLayout[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const category = normalizeBubbleCategory(node.category);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const categories = [...counts.keys()].toSorted((left, right) => left.localeCompare(right, "ja"));
  if (categories.length === 0) return [];

  const radii = categories.map((category) => bubbleCategoryRadius(counts.get(category) ?? 0));
  const maximumRadius = Math.max(...radii);
  const ringRadius = categories.length === 1
    ? maximumRadius + 180
    : (maximumRadius - bubbleCategoryDesiredOverlap / 2) /
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
    const category = normalizeBubbleCategory(node.category);
    if (!category || node.x === undefined || node.y === undefined) continue;
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
  const category = normalizeBubbleCategory(node.category);
  if (!category) return null;
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

export function bubbleCategoryRegions(
  layouts: Iterable<BubbleCategoryLayout>,
  nodes: Iterable<BubbleCategoryForceNode> = []
): Map<string, BubbleCategoryRegion> {
  const ordered = [...layouts];
  const orderedNodes = [...nodes];
  return new Map(ordered.map((layout) => {
    const contacts = ordered.flatMap((other): BubbleCategoryContact[] => {
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
    const pressures = orderedNodes.flatMap((node): BubbleCategoryPressure[] => {
      if (normalizeBubbleCategory(node.category) !== layout.category ||
          node.x === undefined || node.y === undefined) return [];
      const dx = node.x - layout.x;
      const dy = node.y - layout.y;
      const distance = Math.hypot(dx, dy);
      const pressureRadius = Math.min(
        layout.radius + bubbleCategoryMaximumBulge,
        distance + bubbleCategoryNodeClearance(node)
      );
      if (pressureRadius <= layout.radius) return [];
      return [{ angle: Math.atan2(dy, dx), radius: pressureRadius }];
    });
    const obstacles = orderedNodes.flatMap((node): BubbleCategoryObstacle[] => {
      if (normalizeBubbleCategory(node.category) === layout.category ||
          node.x === undefined || node.y === undefined) return [];
      const dx = node.x - layout.x;
      const dy = node.y - layout.y;
      const distance = Math.hypot(dx, dy);
      const radius = bubbleCategoryNodeClearance(node);
      if (distance >= layout.radius + radius) return [];
      return [{ angle: Math.atan2(dy, dx), distance, radius }];
    });
    return [layout.category, { ...layout, contacts, obstacles, pressures }];
  }));
}

export function bubbleCategoryTarget<T extends BubbleCategoryLayout>(
  node: BubbleCategoryNode,
  layouts: ReadonlyMap<string, T>
): T | null {
  const category = normalizeBubbleCategory(node.category);
  return category ? layouts.get(category) ?? null : null;
}

export function bubbleCategoryBoundaryRadius(
  region: BubbleCategoryRegion,
  angle: number
): number {
  let boundaryRadius = region.radius;
  for (const pressure of region.pressures) {
    const progress = Math.max(
      0,
      1 - Math.abs(normalizeAngle(angle - pressure.angle)) / bubbleCategoryPressureHalfAngle
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
  for (const obstacle of region.obstacles) {
    boundaryRadius = Math.min(
      boundaryRadius,
      bubbleCategoryObstacleBoundaryRadius(region, obstacle, angle)
    );
  }
  return boundaryRadius;
}

export function bubbleCategoryContour(
  region: BubbleCategoryRegion,
  pointCount = 72
): BubbleCategoryPoint[] {
  const count = Math.max(12, Math.floor(pointCount));
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    const radius = bubbleCategoryBoundaryRadius(region, angle);
    return {
      x: region.x + Math.cos(angle) * radius,
      y: region.y + Math.sin(angle) * radius
    };
  });
}

export function constrainBubbleCategoryPoint(
  node: BubbleCategoryNode,
  regions: ReadonlyMap<string, BubbleCategoryRegion>,
  point: BubbleCategoryPoint,
  padding = bubbleCategoryBoundaryPadding
): BubbleCategoryPoint {
  const region = bubbleCategoryTarget(node, regions);
  if (!region) return point;

  const dx = point.x - region.x;
  const dy = point.y - region.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return point;

  const angle = Math.atan2(dy, dx);
  const maximumDistance = Math.max(
    0,
    Math.max(
      bubbleCategoryBoundaryRadius(region, angle),
      bubbleCategoryDeformableBoundaryRadius(region, angle)
    ) - Math.max(0, padding)
  );
  if (distance <= maximumDistance) return point;
  return {
    x: region.x + dx / distance * maximumDistance,
    y: region.y + dy / distance * maximumDistance
  };
}

export function applyBubbleCategoryBoundary(
  nodes: Iterable<BubbleCategoryForceNode>,
  regions: ReadonlyMap<string, BubbleCategoryRegion>,
  _alpha: number
): void {
  for (const node of nodes) {
    if (node.x === undefined || node.y === undefined) continue;
    const predicted = {
      x: node.x + (node.vx ?? 0),
      y: node.y + (node.vy ?? 0)
    };
    const ownRegion = bubbleCategoryTarget(node, regions);
    const tracksSingletonCenter = ownRegion?.count === 1 &&
      node.categoryCenterOffsetX !== undefined &&
      node.categoryCenterOffsetY !== undefined;
    const constrained = tracksSingletonCenter
      ? constrainBubbleCategoryExteriorPoint(node, regions, predicted)
      : constrainBubbleNodeToCategoryRegions(node, regions, predicted);
    if (tracksSingletonCenter) {
      const centerOffset = bubbleCategoryCenterOffsetForNodeDrag(
        node,
        regions.values(),
        constrained,
        bubbleCategoryNodeClearance(node)
      );
      if (centerOffset) {
        node.categoryCenterOffsetX = centerOffset.x;
        node.categoryCenterOffsetY = centerOffset.y;
      }
    }
    node.vx = constrained.x - node.x;
    node.vy = constrained.y - node.y;
  }
}

export function constrainBubbleNodeToCategoryRegions(
  node: BubbleCategoryForceNode,
  regions: ReadonlyMap<string, BubbleCategoryRegion>,
  point: BubbleCategoryPoint,
  padding = bubbleCategoryBoundaryPadding
): BubbleCategoryPoint {
  return constrainBubbleCategoryExteriorPoint(
    node,
    regions,
    constrainBubbleCategoryPoint(node, regions, point, padding)
  );
}

export function applyBubbleCategoryMotion(
  nodes: Iterable<BubbleCategoryForceNode>,
  alpha: number
): Map<string, BubbleCategoryRegion> {
  const orderedNodes = [...nodes];
  const regions = bubbleCategoryRegions(
    bubbleCategoryDynamicLayouts(orderedNodes),
    orderedNodes
  );
  const nodesByCategory = new Map<string, BubbleCategoryForceNode[]>();
  for (const node of orderedNodes) {
    const category = normalizeBubbleCategory(node.category);
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
      const minimumDistance = left.radius + right.radius - bubbleCategoryDesiredOverlap;
      if (distance >= minimumDistance) continue;

      const fallbackAngle = (leftIndex + rightIndex * 0.5) * Math.PI * 2 /
        Math.max(2, orderedRegions.length);
      const unitX = distance === 0 ? Math.cos(fallbackAngle) : dx / distance;
      const unitY = distance === 0 ? Math.sin(fallbackAngle) : dy / distance;
      const impulses = bubbleCategoryCollisionImpulses(
        minimumDistance - distance,
        alpha,
        left.count,
        right.count
      );
      shiftCategoryVelocity(
        nodesByCategory.get(left.category),
        -unitX * impulses.left,
        -unitY * impulses.left
      );
      shiftCategoryVelocity(
        nodesByCategory.get(right.category),
        unitX * impulses.right,
        unitY * impulses.right
      );
    }
  }

  for (const node of orderedNodes) {
    const region = bubbleCategoryTarget(node, regions);
    if (!region || node.x === undefined || node.y === undefined) continue;
    if (region.count === 1) continue;
    const impulse = bubbleCategoryAttractionImpulse(
      region.x - node.x,
      region.y - node.y,
      alpha
    );
    node.vx = (node.vx ?? 0) + impulse.x;
    node.vy = (node.vy ?? 0) + impulse.y;
  }
  applyBubbleCategoryExteriorReaction(
    orderedNodes,
    nodesByCategory,
    orderedRegions,
    alpha
  );
  applyBubbleCategoryBoundary(orderedNodes, regions, alpha);
  return regions;
}

export function translateBubbleCategoryNodes<T extends BubbleCategoryForceNode>(
  nodes: Iterable<T>,
  category: string,
  dx: number,
  dy: number
): T[] {
  const normalizedCategory = normalizeBubbleCategory(category);
  if (!normalizedCategory) return [];

  const translated: T[] = [];
  for (const node of nodes) {
    if (normalizeBubbleCategory(node.category) !== normalizedCategory ||
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

export function translateBubbleCategoryNodesWithPush<T extends BubbleCategoryForceNode>(
  nodes: Iterable<T>,
  category: string,
  dx: number,
  dy: number
): T[] {
  const orderedNodes = [...nodes];
  const normalizedCategory = normalizeBubbleCategory(category);
  if (!normalizedCategory || (dx === 0 && dy === 0)) return [];

  const distance = Math.hypot(dx, dy);
  const stepCount = Math.max(1, Math.ceil(distance / bubbleCategoryTranslationStep));
  const movedNodes = new Set<T>();
  for (let step = 0; step < stepCount; step += 1) {
    for (const node of translateBubbleCategoryStep(
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
  nodes: BubbleCategoryForceNode[] | undefined,
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

function bubbleCategoryNodeClearance(node: BubbleCategoryForceNode): number {
  const weight = Math.max(0, (node.backlinkCount ?? 0) + (node.linkCount ?? 0));
  return Math.max(18, Math.min(36, 3 * Math.sqrt(weight + 1) + 10));
}

function bubbleCategoryDeformableBoundaryRadius(
  region: BubbleCategoryRegion,
  angle: number
): number {
  let radius = region.radius + bubbleCategoryMaximumBulge;
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
  for (const obstacle of region.obstacles) {
    radius = Math.min(
      radius,
      bubbleCategoryObstacleBoundaryRadius(region, obstacle, angle)
    );
  }
  return radius;
}

function bubbleCategoryObstacleBoundaryRadius(
  region: Pick<BubbleCategoryRegion, "radius">,
  obstacle: BubbleCategoryObstacle,
  angle: number
): number {
  const indentation = Math.min(
    obstacle.radius * bubbleCategoryExteriorMaximumIndentationRatio,
    Math.max(0, region.radius + obstacle.radius - obstacle.distance)
  );
  if (indentation === 0) return region.radius;

  const delta = Math.abs(normalizeAngle(angle - obstacle.angle));
  const obstacleAngularRadius = Math.asin(Math.min(
    1,
    obstacle.radius / Math.max(obstacle.distance, obstacle.radius)
  ));
  const halfAngle = Math.max(
    0.18,
    Math.min(bubbleCategoryPressureHalfAngle, obstacleAngularRadius * 1.4)
  );
  const progress = Math.max(0, 1 - delta / halfAngle);
  const smoothIndentation = progress * progress * (3 - 2 * progress);
  return Math.max(0, region.radius - indentation * smoothIndentation);
}

function applyBubbleCategoryExteriorReaction(
  nodes: BubbleCategoryForceNode[],
  nodesByCategory: ReadonlyMap<string, BubbleCategoryForceNode[]>,
  regions: BubbleCategoryRegion[],
  alpha: number
): void {
  for (const region of regions) {
    for (const node of nodes) {
      if (normalizeBubbleCategory(node.category) === region.category ||
          node.x === undefined || node.y === undefined) continue;
      const dx = region.x - node.x;
      const dy = region.y - node.y;
      const distance = Math.hypot(dx, dy);
      const responseDistance = region.radius +
        bubbleCategoryNodeClearance(node);
      if (distance >= responseDistance) continue;

      const fallbackAngle = stableCategoryAngle(
        region.category,
        normalizeBubbleCategory(node.category) ?? "uncategorized"
      );
      const unitX = distance === 0 ? Math.cos(fallbackAngle) : dx / distance;
      const unitY = distance === 0 ? Math.sin(fallbackAngle) : dy / distance;
      const correction = bubbleCategoryExteriorImpulse(
        responseDistance - distance,
        alpha,
        region.count
      );
      shiftCategoryVelocity(
        nodesByCategory.get(region.category),
        unitX * correction,
        unitY * correction
      );
    }
  }
}

function constrainBubbleCategoryExteriorPoint(
  node: BubbleCategoryForceNode,
  regions: ReadonlyMap<string, BubbleCategoryRegion>,
  point: BubbleCategoryPoint
): BubbleCategoryPoint {
  const ownCategory = normalizeBubbleCategory(node.category);
  let constrained = point;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const region of regions.values()) {
      if (region.category === ownCategory) continue;
      const dx = constrained.x - region.x;
      const dy = constrained.y - region.y;
      const distance = Math.hypot(dx, dy);
      const fallbackAngle = stableCategoryAngle(ownCategory ?? "uncategorized", region.category);
      const angle = distance === 0 ? fallbackAngle : Math.atan2(dy, dx);
      const minimumDistance = bubbleCategoryBoundaryRadius(region, angle) +
        bubbleCategoryNodeClearance(node);
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

function translateBubbleCategoryStep<T extends BubbleCategoryForceNode>(
  nodes: T[],
  category: string,
  dx: number,
  dy: number
): T[] {
  const layouts = bubbleCategoryDynamicLayouts(nodes);
  const layoutByCategory = new Map(layouts.map((layout) => [layout.category, layout]));
  if (!layoutByCategory.has(category)) return [];

  const translations = new Map<string, BubbleCategoryPoint>([
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
      const minimumDistance = moving.radius + other.radius - bubbleCategoryDesiredOverlap;
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
    for (const node of translateBubbleCategoryNodes(
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
