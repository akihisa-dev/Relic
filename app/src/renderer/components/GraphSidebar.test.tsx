import { describe, expect, it } from "vitest";

import { buildGraphViewBox } from "./GraphSidebar";

describe("buildGraphViewBox", () => {
  it("keeps the graph centered at default zoom", () => {
    expect(buildGraphViewBox(1, { x: 0, y: 0 })).toEqual({
      height: 520,
      width: 720,
      x: 0,
      y: 0
    });
  });

  it("moves the camera through the graph instead of translating the graph layer", () => {
    const viewBox = buildGraphViewBox(1.8, { x: 48, y: -32 });

    expect(viewBox.width).toBeCloseTo(400);
    expect(viewBox.height).toBeCloseTo(288.889);
    expect(viewBox.x).toBeCloseTo(208);
    expect(viewBox.y).toBeCloseTo(83.556);
  });
});
