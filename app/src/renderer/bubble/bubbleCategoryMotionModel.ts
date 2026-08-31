import {
  bubbleCategoryAttractionImpulse,
  bubbleCategoryCollisionImpulses,
  bubbleCategoryExteriorImpulse,
  bubbleCategorySeparationOffsets
} from "./bubblePhysicsModel";
import {
  bubbleCategoryContactOverlap,
  bubbleCategoryGroupKey,
  bubbleCategorySpacing,
  stableBubbleCategoryAngle,
  type BubbleCategoryForceNode,
  type BubbleCategoryRegion
} from "./bubbleCategoryCore";
import { bubbleCategoryDynamicLayouts } from "./bubbleCategoryLayoutModel";
import {
  applyBubbleCategoryBoundary,
  bubbleCategoryNodeClearance,
  bubbleCategoryRegions,
  bubbleCategoryTarget
} from "./bubbleCategoryRegionModel";

const bubbleCategorySpacingProjectionMaximumPasses = 32;
const bubbleCategorySpacingProjectionTolerance = 0.001;

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
    const category = bubbleCategoryGroupKey(node.category);
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
    const category = bubbleCategoryGroupKey(node.category);
    if (node.x === undefined || node.y === undefined) continue;
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

function applyBubbleCategoryExteriorReaction(
  nodes: BubbleCategoryForceNode[],
  nodesByCategory: ReadonlyMap<string, BubbleCategoryForceNode[]>,
  regions: BubbleCategoryRegion[],
  alpha: number
): void {
  for (const region of regions) {
    for (const node of nodes) {
      if (bubbleCategoryGroupKey(node.category) === region.category ||
          node.x === undefined || node.y === undefined) continue;
      const dx = region.x - node.x;
      const dy = region.y - node.y;
      const distance = Math.hypot(dx, dy);
      const responseDistance = region.radius +
        bubbleCategoryNodeClearance(node);
      if (distance >= responseDistance) continue;

      const fallbackAngle = stableBubbleCategoryAngle(
        region.category,
        bubbleCategoryGroupKey(node.category)
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
