import {
  bubbleCategoryGroupKey,
  stableBubbleCategoryAngle,
  type BubbleCategoryContact,
  type BubbleCategoryForceNode,
  type BubbleCategoryLayout,
  type BubbleCategoryNode,
  type BubbleCategoryObstacle,
  type BubbleCategoryPoint,
  type BubbleCategoryRegion
} from "./bubbleCategoryCore";
import {
  bubbleCategoryBoundaryPadding,
  bubbleCategoryCenterOffsetForNodeDrag,
  bubbleCategoryDynamicLayouts
} from "./bubbleCategoryLayoutModel";

const bubbleCategoryExteriorMaximumIndentationRatio = 0.75;
const bubbleCategoryPressureHalfAngle = Math.PI / 5;

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
      if (bubbleCategoryGroupKey(node.category) === layout.category ||
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
  return layouts.get(bubbleCategoryGroupKey(node.category)) ?? null;
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

export function bubbleCategoryNodeClearance(node: BubbleCategoryForceNode): number {
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

function constrainBubbleCategoryExteriorPoint(
  node: BubbleCategoryForceNode,
  regions: ReadonlyMap<string, BubbleCategoryRegion>,
  point: BubbleCategoryPoint
): BubbleCategoryPoint {
  const ownCategory = bubbleCategoryGroupKey(node.category);
  let constrained = point;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const region of regions.values()) {
      if (region.category === ownCategory) continue;
      const dx = constrained.x - region.x;
      const dy = constrained.y - region.y;
      const distance = Math.hypot(dx, dy);
      const fallbackAngle = stableBubbleCategoryAngle(ownCategory, region.category);
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
