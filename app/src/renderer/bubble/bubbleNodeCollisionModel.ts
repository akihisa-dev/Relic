import { bubbleNodeBaseRadiusFromWeight } from "./bubbleLayout";
import type { BubbleOptions } from "./bubbleTypes";

export interface BubbleCollisionNode {
  backlinkCount: number;
  fx?: number | null;
  fy?: number | null;
  id?: string;
  linkCount: number;
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

const bubbleNodeSpacingProjectionMaximumPasses = 32;
const bubbleNodeSpacingProjectionTolerance = 0.001;
const bubbleNodeSpatialHashNeighborRange = 1;
const bubbleSpiralAngle = 2.399963229728653;

export function bubbleNodeCollisionRadius(
  node: Pick<BubbleCollisionNode, "backlinkCount" | "linkCount">,
  options: Pick<BubbleOptions, "nodeSizeMultiplier">
): number {
  return bubbleNodeBaseRadiusFromWeight(
    node.backlinkCount + node.linkCount,
    options
  );
}

export function constrainBubbleNodeSpacing<T extends BubbleCollisionNode>(
  nodes: Iterable<T>,
  options: Pick<BubbleOptions, "nodeSizeMultiplier">,
  anchoredNodeIds: ReadonlySet<string> = new Set()
): void {
  const orderedNodes = [...nodes].filter((node) => node.x !== undefined && node.y !== undefined);
  if (orderedNodes.length < 2) return;

  const radii = orderedNodes.map((node) => bubbleNodeCollisionRadius(node, options));
  const cellSize = Math.max(
    1,
    radii.reduce((maximum, radius) => Math.max(maximum, radius), 0) * 2
  );
  for (
    let pass = 0;
    pass < bubbleNodeSpacingProjectionMaximumPasses;
    pass += 1
  ) {
    const buckets = buildSpatialHash(orderedNodes, cellSize);
    let corrected = false;
    for (let leftIndex = 0; leftIndex < orderedNodes.length; leftIndex += 1) {
      const left = orderedNodes[leftIndex]!;
      const leftCell = spatialHashCell(left, cellSize);
      for (let cellX = -bubbleNodeSpatialHashNeighborRange; cellX <= bubbleNodeSpatialHashNeighborRange; cellX += 1) {
        for (let cellY = -bubbleNodeSpatialHashNeighborRange; cellY <= bubbleNodeSpatialHashNeighborRange; cellY += 1) {
          const bucket = buckets.get(`${leftCell.x + cellX},${leftCell.y + cellY}`);
          for (const rightIndex of bucket ?? []) {
            if (rightIndex <= leftIndex) continue;
            const right = orderedNodes[rightIndex]!;
            const dx = right.x! - left.x!;
            const dy = right.y! - left.y!;
            const distance = Math.hypot(dx, dy);
            const penetration = radii[leftIndex]! + radii[rightIndex]! - distance;
            if (penetration <= bubbleNodeSpacingProjectionTolerance) continue;

            const leftAnchored = isBubbleNodeAnchored(left, anchoredNodeIds);
            const rightAnchored = isBubbleNodeAnchored(right, anchoredNodeIds);
            if (leftAnchored && rightAnchored) continue;

            const fallbackAngle = (leftIndex + rightIndex * 0.5) * bubbleSpiralAngle;
            const unitX = distance === 0 ? Math.cos(fallbackAngle) : dx / distance;
            const unitY = distance === 0 ? Math.sin(fallbackAngle) : dy / distance;
            const leftMass = bubbleNodeMass(left);
            const rightMass = bubbleNodeMass(right);
            const totalMass = leftMass + rightMass;
            const leftOffset = leftAnchored
              ? 0
              : rightAnchored
                ? penetration
                : penetration * rightMass / totalMass;
            const rightOffset = rightAnchored
              ? 0
              : leftAnchored
                ? penetration
                : penetration * leftMass / totalMass;

            if (!leftAnchored) {
              left.x! -= unitX * leftOffset;
              left.y! -= unitY * leftOffset;
            }
            if (!rightAnchored) {
              right.x! += unitX * rightOffset;
              right.y! += unitY * rightOffset;
            }

            const relativeVelocity = (
              (right.vx ?? 0) - (left.vx ?? 0)
            ) * unitX + (
              (right.vy ?? 0) - (left.vy ?? 0)
            ) * unitY;
            if (relativeVelocity < 0) {
              const closingSpeed = -relativeVelocity;
              const leftVelocity = leftAnchored
                ? 0
                : rightAnchored
                  ? closingSpeed
                  : closingSpeed * rightMass / totalMass;
              const rightVelocity = rightAnchored
                ? 0
                : leftAnchored
                  ? closingSpeed
                  : closingSpeed * leftMass / totalMass;
              shiftBubbleNodeVelocity(left, -unitX * leftVelocity, -unitY * leftVelocity);
              shiftBubbleNodeVelocity(right, unitX * rightVelocity, unitY * rightVelocity);
            }
            corrected = true;
          }
        }
      }
    }
    if (!corrected) return;
  }
}

export function constrainBubbleNodePosition<T extends BubbleCollisionNode>(
  node: T,
  others: Iterable<T>,
  point: { x: number; y: number },
  options: Pick<BubbleOptions, "nodeSizeMultiplier">
): { x: number; y: number } {
  const orderedOthers = [...others];
  const nodeRadius = bubbleNodeCollisionRadius(node, options);
  let constrained = point;

  for (let pass = 0; pass < 8; pass += 1) {
    let corrected = false;
    for (let otherIndex = 0; otherIndex < orderedOthers.length; otherIndex += 1) {
      const other = orderedOthers[otherIndex]!;
      if (other === node || (node.id !== undefined && node.id === other.id) ||
          other.x === undefined || other.y === undefined) continue;

      const dx = constrained.x - other.x;
      const dy = constrained.y - other.y;
      const distance = Math.hypot(dx, dy);
      const minimumDistance = nodeRadius + bubbleNodeCollisionRadius(other, options);
      if (distance >= minimumDistance) continue;

      const fallbackAngle = (otherIndex + 1) * bubbleSpiralAngle;
      const unitX = distance === 0 ? Math.cos(fallbackAngle) : dx / distance;
      const unitY = distance === 0 ? Math.sin(fallbackAngle) : dy / distance;
      constrained = {
        x: other.x + unitX * minimumDistance,
        y: other.y + unitY * minimumDistance
      };
      corrected = true;
    }
    if (!corrected) return constrained;
  }

  return constrained;
}

function buildSpatialHash<T extends BubbleCollisionNode>(
  nodes: T[],
  cellSize: number
): Map<string, number[]> {
  const buckets = new Map<string, number[]>();
  nodes.forEach((node, index) => {
    const cell = spatialHashCell(node, cellSize);
    const key = `${cell.x},${cell.y}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(index);
    buckets.set(key, bucket);
  });
  return buckets;
}

function spatialHashCell(node: BubbleCollisionNode, cellSize: number): { x: number; y: number } {
  return {
    x: Math.floor(node.x! / cellSize),
    y: Math.floor(node.y! / cellSize)
  };
}

function bubbleNodeMass(node: Pick<BubbleCollisionNode, "backlinkCount" | "linkCount">): number {
  return Math.max(1, node.backlinkCount + node.linkCount);
}

function isBubbleNodeAnchored(
  node: BubbleCollisionNode,
  anchoredNodeIds: ReadonlySet<string>
): boolean {
  return (node.id !== undefined && anchoredNodeIds.has(node.id)) ||
    (node.fx !== undefined && node.fx !== null) ||
    (node.fy !== undefined && node.fy !== null);
}

function shiftBubbleNodeVelocity(node: BubbleCollisionNode, dx: number, dy: number): void {
  if (node.vx !== undefined) node.vx += dx;
  if (node.vy !== undefined) node.vy += dy;
}
