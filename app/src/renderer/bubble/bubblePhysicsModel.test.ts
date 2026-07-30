import { describe, expect, it } from "vitest";

import {
  bubbleCategoryAttractionImpulse,
  bubbleCategoryCollisionImpulses,
  bubbleCategoryExteriorImpulse,
  bubbleCategorySeparationOffsets,
  bubbleLinkAttractionStrength
} from "./bubblePhysicsModel";
import { bubbleCategoryDriftCenterStrength } from "./bubbleCategoryModel";
import { defaultBubbleOptions } from "./bubbleTypes";

describe("bubblePhysicsModel", () => {
  it("リンクの拘束を弱め、ノード間の反発を保つ", () => {
    expect(bubbleLinkAttractionStrength(defaultBubbleOptions.linkStrength, 1))
      .toBeCloseTo(0.32);
    expect(bubbleLinkAttractionStrength(defaultBubbleOptions.linkStrength, 4))
      .toBeCloseTo(0.52);
    expect(defaultBubbleOptions.repelStrength).toBe(12);
  });

  it("全体を中央へ押し込みすぎない弱い復帰力を使う", () => {
    expect(defaultBubbleOptions.centerStrength).toBe(0.04);
    expect(bubbleCategoryDriftCenterStrength).toBe(0.003);
  });

  it("カテゴリ中心の近くでは吸着せず、遠距離でも急加速しない", () => {
    expect(bubbleCategoryAttractionImpulse(12, 0, 1)).toEqual({ x: 0, y: 0 });
    expect(bubbleCategoryAttractionImpulse(118, 0, 1)).toEqual({ x: 5, y: 0 });
  });

  it("大きいバブルほど衝突で動きにくくする", () => {
    const equal = bubbleCategoryCollisionImpulses(40, 1, 2, 2);
    const weighted = bubbleCategoryCollisionImpulses(40, 1, 8, 2);
    const separated = bubbleCategorySeparationOffsets(40, 8, 2);

    expect(equal.left).toBeCloseTo(equal.right);
    expect(weighted.left).toBeLessThan(weighted.right);
    expect(weighted.left + weighted.right).toBeCloseTo(equal.left + equal.right);
    expect(separated.left).toBeLessThan(separated.right);
    expect(separated.left + separated.right).toBeCloseTo(40);
  });

  it("外部ノードの反力を所属ノード数に応じて分散する", () => {
    expect(bubbleCategoryExteriorImpulse(20, 1, 9))
      .toBeCloseTo(bubbleCategoryExteriorImpulse(20, 1, 1) / 3);
  });
});
