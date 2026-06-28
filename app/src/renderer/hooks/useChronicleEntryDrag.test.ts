import { describe, expect, it } from "vitest";

import { chronicleRangeForEdit } from "./useChronicleEntryDrag";

describe("chronicleRangeForEdit", () => {
  it("moveは開始と終了を同じ差分だけ動かす", () => {
    expect(chronicleRangeForEdit("move", 120, 132, 3)).toEqual({
      endValue: 135,
      startValue: 123
    });
  });

  it("resize-startは開始側だけを更新し、終了を超えない", () => {
    expect(chronicleRangeForEdit("resize-start", 120, 132, 3)).toEqual({
      endValue: 132,
      startValue: 123
    });
    expect(chronicleRangeForEdit("resize-start", 120, 132, 20)).toEqual({
      endValue: 132,
      startValue: 132
    });
  });

  it("resize-endは終了側だけを更新し、開始を下回らない", () => {
    expect(chronicleRangeForEdit("resize-end", 120, 132, -3)).toEqual({
      endValue: 129,
      startValue: 120
    });
    expect(chronicleRangeForEdit("resize-end", 120, 132, -20)).toEqual({
      endValue: 120,
      startValue: 120
    });
  });
});
