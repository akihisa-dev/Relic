export const bubbleCategoryAttractionStrength = 0.14;

const bubbleCategoryAttractionSlack = 18;
const bubbleCategoryMaximumAttractionImpulse = 5;
const bubbleCategoryMaximumCollisionImpulse = 8;
const bubbleCategoryMaximumExteriorImpulse = 5;
const bubbleCategoryCollisionStrength = 0.16;
const bubbleCategoryExteriorReactionStrength = 0.16;
const bubbleLinkMaximumStrength = 0.86;

export interface BubblePhysicsVector {
  x: number;
  y: number;
}

export interface BubbleCategoryCollisionImpulses {
  left: number;
  right: number;
}

export function bubbleLinkAttractionStrength(baseStrength: number, count: number): number {
  return Math.min(
    bubbleLinkMaximumStrength,
    Math.max(0, baseStrength) * Math.sqrt(Math.max(1, count))
  );
}

export function bubbleCategoryAttractionImpulse(
  dx: number,
  dy: number,
  alpha: number
): BubblePhysicsVector {
  const distance = Math.hypot(dx, dy);
  const extension = Math.max(0, distance - bubbleCategoryAttractionSlack);
  if (distance === 0 || extension === 0) return { x: 0, y: 0 };

  const impulse = Math.min(
    bubbleCategoryMaximumAttractionImpulse,
    extension * bubbleCategoryAttractionStrength * Math.max(0, alpha)
  );
  return {
    x: dx / distance * impulse,
    y: dy / distance * impulse
  };
}

export function bubbleCategoryCollisionImpulses(
  penetration: number,
  alpha: number,
  leftNodeCount: number,
  rightNodeCount: number
): BubbleCategoryCollisionImpulses {
  const leftMass = Math.max(1, leftNodeCount);
  const rightMass = Math.max(1, rightNodeCount);
  const totalMass = leftMass + rightMass;
  const impulse = Math.min(
    bubbleCategoryMaximumCollisionImpulse,
    Math.max(0, penetration) * bubbleCategoryCollisionStrength * Math.max(0, alpha)
  );
  return {
    left: impulse * 2 * rightMass / totalMass,
    right: impulse * 2 * leftMass / totalMass
  };
}

export function bubbleCategoryExteriorImpulse(
  penetration: number,
  alpha: number,
  nodeCount: number
): number {
  const impulse = Math.min(
    bubbleCategoryMaximumExteriorImpulse,
    Math.max(0, penetration) * bubbleCategoryExteriorReactionStrength * Math.max(0, alpha)
  );
  return impulse / Math.sqrt(Math.max(1, nodeCount));
}
