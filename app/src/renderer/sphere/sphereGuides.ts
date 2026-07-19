import { Group, type ColorRepresentation } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

const RING_SEGMENTS = 128;
const GUIDE_CORE_WIDTH = 2.4;
const GUIDE_GLOW_WIDTH = 7;
const GUIDE_RENDER_ORDER = -1;
const GRID_IDLE_OPACITY = 0.16;
const GRID_ACTIVE_OPACITY = 0.4;
const GRID_LINE_WIDTH = 0.85;
const GRID_LATITUDES = [-60, -30, 30, 60] as const;
const GRID_MERIDIANS = [0, 45, 90, 135] as const;

export interface SphereGuides {
  dispose: () => void;
  group: Group;
  setColor: (color: ColorRepresentation) => void;
  setInteractionActive: (active: boolean) => void;
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

function latitudePositions(radius: number, latitude: number): number[] {
  const latitudeRadians = latitude * Math.PI / 180;
  const latitudeRadius = Math.cos(latitudeRadians) * radius;
  const y = Math.sin(latitudeRadians) * radius;
  return Array.from({ length: RING_SEGMENTS + 1 }, (_, index) => {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    return [Math.cos(angle) * latitudeRadius, y, Math.sin(angle) * latitudeRadius];
  }).flat();
}

function meridianPositions(radius: number, longitude: number): number[] {
  const longitudeRadians = longitude * Math.PI / 180;
  return Array.from({ length: RING_SEGMENTS + 1 }, (_, index) => {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    const horizontalRadius = Math.cos(angle) * radius;
    return [
      horizontalRadius * Math.cos(longitudeRadians),
      Math.sin(angle) * radius,
      horizontalRadius * Math.sin(longitudeRadians)
    ];
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
  const gridDashSize = Math.max(2.5, guideRadius * 0.012);
  const gridGapSize = gridDashSize * 1.7;
  const group = new Group();
  group.name = "sphere-guides";

  const axisGlowMaterial = guideMaterial(color, 0.22, GUIDE_GLOW_WIDTH, dashSize, gapSize);
  const axisMaterial = guideMaterial(color, 1, GUIDE_CORE_WIDTH, dashSize, gapSize);
  const ringGlowMaterial = guideMaterial(color, 0.2, GUIDE_GLOW_WIDTH, dashSize, gapSize);
  const ringMaterial = guideMaterial(color, 0.96, GUIDE_CORE_WIDTH, dashSize, gapSize);
  const gridMaterial = guideMaterial(
    color,
    GRID_IDLE_OPACITY,
    GRID_LINE_WIDTH,
    gridDashSize,
    gridGapSize
  );
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
  const latitudeLines = GRID_LATITUDES.map((latitude) => createGuideLine(
    `sphere-grid-latitude-${latitude}`,
    latitudePositions(guideRadius, latitude),
    gridMaterial,
    GUIDE_RENDER_ORDER - 2
  ));
  const meridianLines = GRID_MERIDIANS.map((longitude) => createGuideLine(
    `sphere-grid-meridian-${longitude}`,
    meridianPositions(guideRadius, longitude),
    gridMaterial,
    GUIDE_RENDER_ORDER - 2
  ));
  const gridLines = [...latitudeLines, ...meridianLines];

  group.add(...gridLines, axisGlow, ringGlow, axis, ring);
  const lines = [...gridLines, axisGlow, ringGlow, axis, ring];
  const materials = [axisGlowMaterial, ringGlowMaterial, axisMaterial, ringMaterial, gridMaterial];
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
    setInteractionActive: (active) => {
      gridMaterial.opacity = active ? GRID_ACTIVE_OPACITY : GRID_IDLE_OPACITY;
    },
    setRadius: (nextRadius) => {
      if (!Number.isFinite(nextRadius) || Math.abs(nextRadius - currentRadius) < 0.5) return;
      currentRadius = nextRadius;
      const nextGuideRadius = Math.max(80, nextRadius * 1.08);
      const nextAxisHalfLength = nextGuideRadius * 1.12;
      const nextDashSize = Math.max(3, nextGuideRadius * 0.018);
      const nextGapSize = nextDashSize * 1.3;
      const nextGridDashSize = Math.max(2.5, nextGuideRadius * 0.012);
      const nextGridGapSize = nextGridDashSize * 1.7;
      axisGlow.geometry.setPositions(axisPositions(nextAxisHalfLength));
      axis.geometry.setPositions(axisPositions(nextAxisHalfLength));
      ringGlow.geometry.setPositions(ringPositions(nextGuideRadius));
      ring.geometry.setPositions(ringPositions(nextGuideRadius));
      latitudeLines.forEach((line, index) => {
        line.geometry.setPositions(latitudePositions(nextGuideRadius, GRID_LATITUDES[index]!));
      });
      meridianLines.forEach((line, index) => {
        line.geometry.setPositions(meridianPositions(nextGuideRadius, GRID_MERIDIANS[index]!));
      });
      for (const line of lines) line.computeLineDistances();
      for (const material of [axisGlowMaterial, ringGlowMaterial, axisMaterial, ringMaterial]) {
        material.dashSize = nextDashSize;
        material.gapSize = nextGapSize;
      }
      gridMaterial.dashSize = nextGridDashSize;
      gridMaterial.gapSize = nextGridGapSize;
    }
  };
}
