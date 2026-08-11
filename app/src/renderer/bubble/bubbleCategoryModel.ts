import {
  bubbleCategoryAttractionImpulse,
  bubbleCategoryCollisionImpulses,
  bubbleCategoryExteriorImpulse,
  bubbleCategorySeparationOffsets
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

export interface BubbleCategoryObstacle {
  angle: number;
  distance: number;
  radius: number;
}

export interface BubbleCategoryRegion extends BubbleCategoryLayout {
  contacts: BubbleCategoryContact[];
  obstacles: BubbleCategoryObstacle[];
}

export interface BubbleCategoryPoint {
  x: number;
  y: number;
}

export interface BubbleCategoryForceNode extends BubbleCategoryNode {
  backlinkCount?: number;
  categoryCenterOffsetX?: number;
  categoryCenterOffsetY?: number;
  fx?: number | null;
  fy?: number | null;
  id?: string;
  linkCount?: number;
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

export const bubbleCategoryDriftCenterStrength = 0.003;
export const bubbleCategorySpacing = 24;
export const bubbleCategoryContactOverlap = 28;

const bubbleCategoryMinimumRadius = 96;
const bubbleCategoryNodeSpacing = 48;
const bubbleCategoryClusterClearance = 120;
const bubbleCategoryBoundaryPadding = 36;
const bubbleCategoryExteriorMaximumIndentationRatio = 0.75;
const bubbleCategoryPressureHalfAngle = Math.PI / 5;
const bubbleCategorySpacingProjectionMaximumPasses = 32;
const bubbleCategorySpacingProjectionTolerance = 0.001;

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
      if (distance > layout.radius + other.radius) return [];
      return [{
        angle: Math.atan2(dy, dx),
        distance,
        radius: other.radius
      }];
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
    return [layout.category, { ...layout, contacts, obstacles }];
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
    bubbleCategoryBoundaryRadius(region, angle) - Math.max(0, padding)
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

export function constrainBubbleNodesToCategoryRegions(
  nodes: Iterable<BubbleCategoryForceNode>
): Map<string, BubbleCategoryRegion> {
  const orderedNodes = [...nodes];
  const regions = bubbleCategoryRegions(
    bubbleCategoryDynamicLayouts(orderedNodes),
    orderedNodes
  );
  for (const node of orderedNodes) {
    if (node.x === undefined || node.y === undefined) continue;
    const constrained = constrainBubbleNodeToCategoryRegions(
      node,
      regions,
      { x: node.x, y: node.y }
    );
    node.vx = (node.vx ?? 0) + constrained.x - node.x;
    node.vy = (node.vy ?? 0) + constrained.y - node.y;
    node.x = constrained.x;
    node.y = constrained.y;
  }
  return regions;
}

export function applyBubbleCategoryMotion(
  nodes: Iterable<BubbleCategoryForceNode>,
  alpha: number,
  categorySpacing = bubbleCategorySpacing
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
      const minimumDistance = left.radius + right.radius + categorySpacing;
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

export function constrainBubbleCategorySpacing(
  nodes: Iterable<BubbleCategoryForceNode>,
  anchoredNodeIds: ReadonlySet<string> = new Set(),
  allowContact = false
): void {
  const orderedNodes = [...nodes];
  const orderedLayouts = bubbleCategoryDynamicLayouts(orderedNodes);
  if (orderedLayouts.length < 2) return;
  const minimumCategorySpacing = allowContact
    ? -bubbleCategoryContactOverlap
    : bubbleCategorySpacing;

  const nodesByCategory = new Map<string, BubbleCategoryForceNode[]>();
  const anchoredCategories = new Set<string>();
  for (const node of orderedNodes) {
    const category = normalizeBubbleCategory(node.category);
    if (!category || node.x === undefined || node.y === undefined) continue;
    const categoryNodes = nodesByCategory.get(category) ?? [];
    categoryNodes.push(node);
    nodesByCategory.set(category, categoryNodes);
    if (
      (node.id !== undefined && anchoredNodeIds.has(node.id)) ||
      (node.fx !== undefined && node.fx !== null) ||
      (node.fy !== undefined && node.fy !== null)
    ) {
      anchoredCategories.add(category);
    }
  }

  for (
    let pass = 0;
    pass < bubbleCategorySpacingProjectionMaximumPasses;
    pass += 1
  ) {
    let corrected = false;
    for (let leftIndex = 0; leftIndex < orderedLayouts.length; leftIndex += 1) {
      const left = orderedLayouts[leftIndex]!;
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < orderedLayouts.length;
        rightIndex += 1
      ) {
        const right = orderedLayouts[rightIndex]!;
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const distance = Math.hypot(dx, dy);
        const minimumDistance = left.radius + right.radius + minimumCategorySpacing;
        const penetration = minimumDistance - distance;
        if (penetration <= bubbleCategorySpacingProjectionTolerance) continue;

        const leftAnchored = anchoredCategories.has(left.category);
        const rightAnchored = anchoredCategories.has(right.category);
        if (leftAnchored && rightAnchored) continue;

        const fallbackAngle = stableBubbleCategoryAngle(left.category, right.category);
        const unitX = distance === 0 ? Math.cos(fallbackAngle) : dx / distance;
        const unitY = distance === 0 ? Math.sin(fallbackAngle) : dy / distance;
        const offsets = bubbleCategorySeparationOffsets(
          penetration,
          left.count,
          right.count
        );
        const leftOffset = leftAnchored
          ? 0
          : rightAnchored
            ? penetration
            : offsets.left;
        const rightOffset = rightAnchored
          ? 0
          : leftAnchored
            ? penetration
            : offsets.right;
        shiftCategoryPosition(
          nodesByCategory.get(left.category),
          -unitX * leftOffset,
          -unitY * leftOffset
        );
        shiftCategoryPosition(
          nodesByCategory.get(right.category),
          unitX * rightOffset,
          unitY * rightOffset
        );
        left.x -= unitX * leftOffset;
        left.y -= unitY * leftOffset;
        right.x += unitX * rightOffset;
        right.y += unitY * rightOffset;

        const leftNodes = nodesByCategory.get(left.category) ?? [];
        const rightNodes = nodesByCategory.get(right.category) ?? [];
        const relativeVelocity = (
          averageCategoryVelocity(rightNodes, unitX, unitY) -
          averageCategoryVelocity(leftNodes, unitX, unitY)
        );
        if (relativeVelocity < 0) {
          const closingSpeed = -relativeVelocity;
          const leftVelocity = leftAnchored
            ? 0
            : rightAnchored
              ? closingSpeed
              : closingSpeed * right.count / (left.count + right.count);
          const rightVelocity = rightAnchored
            ? 0
            : leftAnchored
              ? closingSpeed
              : closingSpeed * left.count / (left.count + right.count);
          shiftCategoryVelocity(
            leftNodes,
            -unitX * leftVelocity,
            -unitY * leftVelocity
          );
          shiftCategoryVelocity(
            rightNodes,
            unitX * rightVelocity,
            unitY * rightVelocity
          );
        }
        corrected = true;
      }
    }
    if (!corrected) return;
  }
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

function averageCategoryVelocity(
  nodes: BubbleCategoryForceNode[],
  axisX: number,
  axisY: number
): number {
  if (nodes.length === 0) return 0;
  return nodes.reduce(
    (sum, node) => sum + (node.vx ?? 0) * axisX + (node.vy ?? 0) * axisY,
    0
  ) / nodes.length;
}

function shiftCategoryPosition(
  nodes: BubbleCategoryForceNode[] | undefined,
  dx: number,
  dy: number
): void {
  for (const node of nodes ?? []) {
    if (node.x !== undefined) node.x += dx;
    if (node.y !== undefined) node.y += dy;
  }
}

export function stableBubbleCategoryAngle(left: string, right: string): number {
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

      const fallbackAngle = stableBubbleCategoryAngle(
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
      const fallbackAngle = stableBubbleCategoryAngle(ownCategory ?? "uncategorized", region.category);
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

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
