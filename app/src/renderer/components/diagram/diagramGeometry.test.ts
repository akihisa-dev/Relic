import { describe, expect, it } from "vitest";

import { buildLineLayouts, type DiagramCanvasNodeLayout } from "./diagramGeometry";

const horizontalNodes: DiagramCanvasNodeLayout[] = [
  {
    node: {
      file: "a.md",
      height: 80,
      id: "node-1",
      width: 180,
      x: 120,
      y: 80
    },
    x: 180,
    y: 180
  },
  {
    node: {
      file: "b.md",
      height: 80,
      id: "node-2",
      width: 180,
      x: 380,
      y: 80
    },
    x: 440,
    y: 180
  }
];

describe("buildLineLayouts", () => {
  it("connects horizontal lines at node edges instead of centers", () => {
    const [line] = buildLineLayouts([
      {
        from: "node-1",
        id: "line-1",
        label: "関係",
        to: "node-2"
      }
    ], horizontalNodes);

    expect(line).toMatchObject({
      labelX: 400,
      labelY: 212,
      x1: 360,
      x2: 440,
      y1: 220,
      y2: 220
    });
  });

  it("connects diagonal lines at the nearest rectangle edges", () => {
    const [line] = buildLineLayouts([
      {
        from: "node-1",
        id: "line-1",
        label: "",
        to: "node-2"
      }
    ], [
      horizontalNodes[0],
      {
        node: horizontalNodes[1].node,
        x: 440,
        y: 360
      }
    ]);

    expect(line?.x1).toBeCloseTo(327.78, 2);
    expect(line?.x2).toBeCloseTo(472.22, 2);
    expect(line?.y1).toBe(260);
    expect(line?.y2).toBe(360);
  });
});
