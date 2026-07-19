import { Group, type ColorRepresentation } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const RING_SEGMENTS = 128;
const GUIDE_CORE_WIDTH = 2.4;
const GUIDE_GLOW_WIDTH = 7;
const GUIDE_RENDER_ORDER = -1;

export interface SphereGuides {
  dispose: () => void;
  group: Group;
  setColor: (color: ColorRepresentation) => void;
  setRadius: (radius: number) => void;
}

function guideMaterial(
  color: ColorRepresentation,
  opacity: number,
  linewidth: number,
  dashSize: number,
  gapSize: number
) {
  return new LineMaterial({
    alphaToCoverage: true,
    color,
    dashed: true,
    dashSize,
    depthTest: false,
    depthWrite: false,
    gapSize,
    linewidth,
    opacity,
    toneMapped: false,
    transparent: true
  });
}

function axisPositions(axisHalfLength: number): number[] {
  return [0, -axisHalfLength, 0, 0, axisHalfLength, 0];
}

function ringPositions(radius: number): number[] {
  return Array.from({ length: RING_SEGMENTS + 1 }, (_, index) => {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
  }).flat();
}

function createGuideLine(
  name: string,
  positions: number[],
  material: LineMaterial,
  renderOrder: number
): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  const line = new Line2(geometry, material);
  line.name = name;
  line.renderOrder = renderOrder;
  line.computeLineDistances();
  line.raycast = () => undefined;
  return line;
}

export function createSphereGuides(radius: number, color: ColorRepresentation): SphereGuides {
  const guideRadius = Math.max(80, radius * 1.08);
  const axisHalfLength = guideRadius * 1.12;
  const dashSize = Math.max(3, guideRadius * 0.018);
  const gapSize = dashSize * 1.3;
  const group = new Group();
  group.name = "sphere-guides";

  const axisGlowMaterial = guideMaterial(color, 0.22, GUIDE_GLOW_WIDTH, dashSize, gapSize);
  const axisMaterial = guideMaterial(color, 1, GUIDE_CORE_WIDTH, dashSize, gapSize);
  const ringGlowMaterial = guideMaterial(color, 0.2, GUIDE_GLOW_WIDTH, dashSize, gapSize);
  const ringMaterial = guideMaterial(color, 0.96, GUIDE_CORE_WIDTH, dashSize, gapSize);
  const axisGlow = createGuideLine(
    "sphere-center-axis-glow",
    axisPositions(axisHalfLength),
    axisGlowMaterial,
    GUIDE_RENDER_ORDER - 1
  );
  const axis = createGuideLine(
    "sphere-center-axis",
    axisPositions(axisHalfLength),
    axisMaterial,
    GUIDE_RENDER_ORDER
  );
  const ringGlow = createGuideLine(
    "sphere-equator-ring-glow",
    ringPositions(guideRadius),
    ringGlowMaterial,
    GUIDE_RENDER_ORDER - 1
  );
  const ring = createGuideLine(
    "sphere-equator-ring",
    ringPositions(guideRadius),
    ringMaterial,
    GUIDE_RENDER_ORDER
  );

  group.add(axisGlow, ringGlow, axis, ring);
  const lines = [axisGlow, ringGlow, axis, ring];
  const materials = [axisGlowMaterial, ringGlowMaterial, axisMaterial, ringMaterial];
  let currentRadius = radius;
  return {
    dispose: () => {
      for (const line of lines) line.geometry.dispose();
      for (const material of materials) material.dispose();
      group.clear();
    },
    group,
    setColor: (nextColor) => {
      for (const material of materials) material.color.set(nextColor);
    },
    setRadius: (nextRadius) => {
      if (!Number.isFinite(nextRadius) || Math.abs(nextRadius - currentRadius) < 0.5) return;
      currentRadius = nextRadius;
      const nextGuideRadius = Math.max(80, nextRadius * 1.08);
      const nextAxisHalfLength = nextGuideRadius * 1.12;
      const nextDashSize = Math.max(3, nextGuideRadius * 0.018);
      const nextGapSize = nextDashSize * 1.3;
      axisGlow.geometry.setPositions(axisPositions(nextAxisHalfLength));
      axis.geometry.setPositions(axisPositions(nextAxisHalfLength));
      ringGlow.geometry.setPositions(ringPositions(nextGuideRadius));
      ring.geometry.setPositions(ringPositions(nextGuideRadius));
      for (const line of lines) line.computeLineDistances();
      for (const material of materials) {
        material.dashSize = nextDashSize;
        material.gapSize = nextGapSize;
      }
    }
  };
}
