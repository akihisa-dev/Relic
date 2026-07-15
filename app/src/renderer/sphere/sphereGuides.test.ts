import { describe, expect, it, vi } from "vitest";
import { Line, LineDashedMaterial, LineLoop } from "three";

import { createSphereGuides, estimateSphereGuideRadius } from "./sphereGuides";

describe("sphereGuides", () => {
  it("ノード配置前に表示するガイド半径を件数から見積もる", () => {
    expect(estimateSphereGuideRadius(0)).toBe(80);
    expect(estimateSphereGuideRadius(1)).toBe(80);
    expect(estimateSphereGuideRadius(1_000)).toBeCloseTo(320);
  });

  it("傾きのない中心軸と水平な赤道リングを点線で生成する", () => {
    const guides = createSphereGuides(100, "#8899aa");
    const axis = guides.group.getObjectByName("sphere-center-axis") as Line;
    const ring = guides.group.getObjectByName("sphere-equator-ring") as LineLoop;
    const axisPositions = axis.geometry.getAttribute("position");
    const ringPositions = ring.geometry.getAttribute("position");

    expect(axisPositions.count).toBe(2);
    expect([axisPositions.getX(0), axisPositions.getZ(0), axisPositions.getX(1), axisPositions.getZ(1)])
      .toEqual([0, 0, 0, 0]);
    expect(axisPositions.getY(0)).toBeLessThan(0);
    expect(axisPositions.getY(1)).toBeGreaterThan(0);
    expect(Array.from({ length: ringPositions.count }, (_, index) => ringPositions.getY(index))
      .every((value) => value === 0)).toBe(true);
    expect(axis.material).toMatchObject({
      isLineDashedMaterial: true,
      opacity: 1,
      toneMapped: false,
      transparent: true
    });
    expect(axis.renderOrder).toBeLessThan(0);
    expect(ring.material).toMatchObject({
      isLineDashedMaterial: true,
      opacity: 0.9,
      toneMapped: false,
      transparent: true
    });
    expect(ring.renderOrder).toBeLessThan(0);
  });

  it("生成したgeometryとmaterialを破棄する", () => {
    const guides = createSphereGuides(100, "#8899aa");
    const axis = guides.group.getObjectByName("sphere-center-axis") as Line;
    const ring = guides.group.getObjectByName("sphere-equator-ring") as LineLoop;
    const resources = [
      axis.geometry,
      axis.material as LineDashedMaterial,
      ring.geometry,
      ring.material as LineDashedMaterial
    ];
    const disposals = resources.map((resource) => {
      const listener = vi.fn();
      resource.addEventListener("dispose", listener);
      return listener;
    });

    guides.dispose();

    for (const listener of disposals) expect(listener).toHaveBeenCalledOnce();
    expect(guides.group.children).toHaveLength(0);
  });
});
