import {
  BufferGeometry,
  Group,
  Line,
  LineDashedMaterial,
  LineLoop,
  Vector3,
  type ColorRepresentation
} from "three";

const RING_SEGMENTS = 128;

export interface SphereGuides {
  dispose: () => void;
  group: Group;
}

function guideMaterial(color: ColorRepresentation, opacity: number, dashSize: number, gapSize: number) {
  return new LineDashedMaterial({
    color,
    dashSize,
    depthTest: true,
    depthWrite: false,
    gapSize,
    opacity,
    transparent: true
  });
}

export function createSphereGuides(radius: number, color: ColorRepresentation): SphereGuides {
  const guideRadius = Math.max(80, radius * 1.08);
  const axisHalfLength = guideRadius * 1.12;
  const dashSize = Math.max(3, guideRadius * 0.018);
  const gapSize = dashSize * 1.3;
  const group = new Group();
  group.name = "sphere-guides";

  const axisGeometry = new BufferGeometry().setFromPoints([
    new Vector3(0, -axisHalfLength, 0),
    new Vector3(0, axisHalfLength, 0)
  ]);
  const axisMaterial = guideMaterial(color, 0.32, dashSize, gapSize);
  const axis = new Line(axisGeometry, axisMaterial);
  axis.name = "sphere-center-axis";
  axis.computeLineDistances();
  axis.raycast = () => undefined;

  const ringPoints = Array.from({ length: RING_SEGMENTS }, (_, index) => {
    const angle = (index / RING_SEGMENTS) * Math.PI * 2;
    return new Vector3(Math.cos(angle) * guideRadius, 0, Math.sin(angle) * guideRadius);
  });
  const ringGeometry = new BufferGeometry().setFromPoints(ringPoints);
  const ringMaterial = guideMaterial(color, 0.24, dashSize, gapSize);
  const ring = new LineLoop(ringGeometry, ringMaterial);
  ring.name = "sphere-equator-ring";
  ring.computeLineDistances();
  ring.raycast = () => undefined;

  group.add(axis, ring);
  return {
    dispose: () => {
      axisGeometry.dispose();
      axisMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      group.clear();
    },
    group
  };
}
