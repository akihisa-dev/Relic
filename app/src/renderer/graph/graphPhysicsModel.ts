export const graphCategoryAttractionStrength = 0.14;

const graphCategoryAttractionSlack = 18;
const graphCategoryMaximumAttractionImpulse = 5;
const graphCategoryMaximumCollisionImpulse = 8;
const graphCategoryMaximumExteriorImpulse = 5;
const graphCategoryCollisionStrength = 0.16;
const graphCategoryExteriorReactionStrength = 0.16;
const graphLinkMaximumStrength = 0.92;

export interface GraphPhysicsVector {
  x: number;
  y: number;
}

export interface GraphCategoryCollisionImpulses {
  left: number;
  right: number;
}

export function graphLinkAttractionStrength(baseStrength: number, count: number): number {
  return Math.min(
    graphLinkMaximumStrength,
    Math.max(0, baseStrength) * Math.sqrt(Math.max(1, count))
  );
}

export function graphCategoryAttractionImpulse(
  dx: number,
  dy: number,
  alpha: number
): GraphPhysicsVector {
  const distance = Math.hypot(dx, dy);
  const extension = Math.max(0, distance - graphCategoryAttractionSlack);
  if (distance === 0 || extension === 0) return { x: 0, y: 0 };

  const impulse = Math.min(
    graphCategoryMaximumAttractionImpulse,
    extension * graphCategoryAttractionStrength * Math.max(0, alpha)
  );
  return {
    x: dx / distance * impulse,
    y: dy / distance * impulse
  };
}

export function graphCategoryCollisionImpulses(
  penetration: number,
  alpha: number,
  leftNodeCount: number,
  rightNodeCount: number
): GraphCategoryCollisionImpulses {
  const leftMass = Math.max(1, leftNodeCount);
  const rightMass = Math.max(1, rightNodeCount);
  const totalMass = leftMass + rightMass;
  const impulse = Math.min(
    graphCategoryMaximumCollisionImpulse,
    Math.max(0, penetration) * graphCategoryCollisionStrength * Math.max(0, alpha)
  );
  return {
    left: impulse * 2 * rightMass / totalMass,
    right: impulse * 2 * leftMass / totalMass
  };
}

export function graphCategoryExteriorImpulse(
  penetration: number,
  alpha: number,
  nodeCount: number
): number {
  const impulse = Math.min(
    graphCategoryMaximumExteriorImpulse,
    Math.max(0, penetration) * graphCategoryExteriorReactionStrength * Math.max(0, alpha)
  );
  return impulse / Math.sqrt(Math.max(1, nodeCount));
}
