import { describe, expect, it } from "vitest";

import { GRAPH_HEIGHT, GRAPH_WIDTH } from "../graphLayout";
import { buildGraphViewBox } from "./GraphSidebar";

describe("buildGraphViewBox", () => {
  it("keeps the graph centered at default zoom", () => {
    expect(buildGraphViewBox(1, { x: 0, y: 0 })).toEqual({
      height: GRAPH_HEIGHT,
      width: GRAPH_WIDTH,
      x: 0,
      y: 0
    });
  });

  it("moves the camera through the graph instead of translating the graph layer", () => {
    const viewBox = buildGraphViewBox(1.8, { x: 48, y: -32 });

    expect(viewBox.width).toBeCloseTo(GRAPH_WIDTH / 1.8);
    expect(viewBox.height).toBeCloseTo(GRAPH_HEIGHT / 1.8);
    expect(viewBox.x).toBeCloseTo((GRAPH_WIDTH - GRAPH_WIDTH / 1.8) / 2 + 48);
    expect(viewBox.y).toBeCloseTo((GRAPH_HEIGHT - GRAPH_HEIGHT / 1.8) / 2 - 32);
  });
});
