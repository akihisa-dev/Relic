export interface BubbleCategoryNode {
  category?: unknown;
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

/** Internal group key used for files whose `category` value is absent or invalid. */
export const bubbleUncategorizedCategory = "__relic_uncategorized__";

export const bubbleCategoryDriftCenterStrength = 0.003;
export const bubbleCategorySpacing = 24;
export const bubbleCategoryContactOverlap = 28;

export function normalizeBubbleCategory(category: unknown): string | null {
  if (typeof category !== "string") return null;
  const normalized = category.trim();
  return normalized || null;
}

export function bubbleCategoryGroupKey(category: unknown): string {
  return normalizeBubbleCategory(category) ?? bubbleUncategorizedCategory;
}

export function isBubbleUncategorizedCategory(category: unknown): boolean {
  return bubbleCategoryGroupKey(category) === bubbleUncategorizedCategory;
}

export function stableBubbleCategoryAngle(left: string, right: string): number {
  let hash = 0;
  for (const character of `${left}\u0000${right}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 1_677_761);
  }
  return (Math.abs(hash) % 360) * Math.PI / 180;
}
