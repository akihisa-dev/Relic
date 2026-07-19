import { describe, expect, it, vi } from "vitest";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import { createSphereGuides } from "./sphereGuides";

describe("sphereGuides", () => {
  it("傾きのない中心軸と水平な赤道リングを点線で生成する", () => {
    const guides = createSphereGuides(100, "#8899aa");
    const axis = guides.group.getObjectByName("sphere-center-axis") as Line2;
    const axisGlow = guides.group.getObjectByName("sphere-center-axis-glow") as Line2;
    const ring = guides.group.getObjectByName("sphere-equator-ring") as Line2;
    const ringGlow = guides.group.getObjectByName("sphere-equator-ring-glow") as Line2;
    const axisStarts = axis.geometry.getAttribute("instanceStart");
    const axisEnds = axis.geometry.getAttribute("instanceEnd");
    const ringStarts = ring.geometry.getAttribute("instanceStart");

    expect(axisStarts.count).toBe(1);
    expect([axisStarts.getX(0), axisStarts.getZ(0), axisEnds.getX(0), axisEnds.getZ(0)])
      .toEqual([0, 0, 0, 0]);
    expect(axisStarts.getY(0)).toBeLessThan(0);
    expect(axisEnds.getY(0)).toBeGreaterThan(0);
    expect(Array.from({ length: ringStarts.count }, (_, index) => ringStarts.getY(index))
      .every((value) => value === 0)).toBe(true);
    expect(axis.material).toMatchObject({
      dashed: true,
      depthTest: false,
      linewidth: 2.4,
      opacity: 1,
      toneMapped: false,
      transparent: true
    });
    expect(axis.renderOrder).toBeLessThan(0);
    expect(ring.material).toMatchObject({
      dashed: true,
      depthTest: false,
      linewidth: 2.4,
      opacity: 0.96,
      toneMapped: false,
      transparent: true
    });
    expect(ring.renderOrder).toBeLessThan(0);
    expect((axisGlow.material as LineMaterial).linewidth).toBeGreaterThan((axis.material as LineMaterial).linewidth);
    expect((ringGlow.material as LineMaterial).linewidth).toBeGreaterThan((ring.material as LineMaterial).linewidth);
  });

  it("同じガイドを維持したまま半径と点線間隔を更新する", () => {
    const guides = createSphereGuides(100, "#8899aa");
    const axis = guides.group.getObjectByName("sphere-center-axis") as Line2;
    const ring = guides.group.getObjectByName("sphere-equator-ring") as Line2;
    const initialRingRadius = ring.geometry.getAttribute("instanceStart").getX(0);
    const initialDashSize = (ring.material as LineMaterial).dashSize;

    guides.setRadius(200);

    expect(guides.group.getObjectByName("sphere-center-axis")).toBe(axis);
    expect(guides.group.getObjectByName("sphere-equator-ring")).toBe(ring);
    expect(ring.geometry.getAttribute("instanceStart").getX(0)).toBeGreaterThan(initialRingRadius);
    expect((ring.material as LineMaterial).dashSize).toBeGreaterThan(initialDashSize);
  });

  it("生成したgeometryとmaterialを破棄する", () => {
    const guides = createSphereGuides(100, "#8899aa");
    const resources = guides.group.children.flatMap((line) => {
      const guideLine = line as Line2;
      return [guideLine.geometry, guideLine.material as LineMaterial];
    });
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
