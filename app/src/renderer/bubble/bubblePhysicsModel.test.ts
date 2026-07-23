import { describe, expect, it } from "vitest";

import {
  bubbleCategoryAttractionImpulse,
  bubbleCategoryCollisionImpulses,
  bubbleCategoryExteriorImpulse,
  bubbleLinkAttractionStrength
} from "./bubblePhysicsModel";

describe("bubblePhysicsModel", () => {
  it("単一リンクを少し弱め、重複リンクも硬くなりすぎないようにする", () => {
    expect(bubbleLinkAttractionStrength(0.72, 1)).toBeCloseTo(0.72);
    expect(bubbleLinkAttractionStrength(0.72, 4)).toBeCloseTo(0.92);
  });

  it("カテゴリ中心の近くでは吸着せず、遠距離でも急加速しない", () => {
    expect(bubbleCategoryAttractionImpulse(12, 0, 1)).toEqual({ x: 0, y: 0 });
    expect(bubbleCategoryAttractionImpulse(118, 0, 1)).toEqual({ x: 5, y: 0 });
  });

  it("大きいバブルほど衝突で動きにくくする", () => {
    const equal = bubbleCategoryCollisionImpulses(40, 1, 2, 2);
    const weighted = bubbleCategoryCollisionImpulses(40, 1, 8, 2);

    expect(equal.left).toBeCloseTo(equal.right);
    expect(weighted.left).toBeLessThan(weighted.right);
    expect(weighted.left + weighted.right).toBeCloseTo(equal.left + equal.right);
  });

  it("外部ノードの反力を所属ノード数に応じて分散する", () => {
    expect(bubbleCategoryExteriorImpulse(20, 1, 9))
      .toBeCloseTo(bubbleCategoryExteriorImpulse(20, 1, 1) / 3);
  });
});
