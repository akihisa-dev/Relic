import {
  bubbleCategoryDynamicLayouts,
  normalizeBubbleCategory,
  stableBubbleCategoryAngle,
  type BubbleCategoryForceNode,
  type BubbleCategoryPoint
} from "./bubbleCategoryModel";

const bubbleCategoryDesiredOverlap = 28;
const bubbleCategoryTranslationStep = 32;

interface BubblePositionNode {
  id: string;
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

export function alignBubbleNodesToCenter<T extends BubblePositionNode>(
  nodes: Iterable<T>,
  nodeIds: ReadonlySet<string>,
  centerX: number,
  centerY: number
): T[] {
  const aligned = [...nodes].filter((node) =>
    nodeIds.has(node.id) && node.x !== undefined && node.y !== undefined
  );
  if (aligned.length === 0) return [];

  const currentCenterX = aligned.reduce((sum, node) => sum + node.x!, 0) / aligned.length;
  const currentCenterY = aligned.reduce((sum, node) => sum + node.y!, 0) / aligned.length;
  const dx = centerX - currentCenterX;
  const dy = centerY - currentCenterY;
  for (const node of aligned) {
    node.x! += dx;
    node.y! += dy;
  }

  const moving = aligned.filter((node) => node.vx !== undefined && node.vy !== undefined);
  if (moving.length > 0) {
    const averageVelocityX = moving.reduce((sum, node) => sum + node.vx!, 0) / moving.length;
    const averageVelocityY = moving.reduce((sum, node) => sum + node.vy!, 0) / moving.length;
    for (const node of moving) {
      node.vx! -= averageVelocityX;
      node.vy! -= averageVelocityY;
    }
  }
  return aligned;
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
        : stableBubbleCategoryAngle(movingCategory, other.category);
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
