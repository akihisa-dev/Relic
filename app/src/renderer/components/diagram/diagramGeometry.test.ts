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
      pathD: "M 360 220 H 440",
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
    expect(line?.pathD).toMatch(/^M .+ V 310 H .+ V 360$/);
    expect(line?.labelX).toBeCloseTo(400, 2);
    expect(line?.labelY).toBe(302);
  });

  it("places labels beside vertical line segments", () => {
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
        x: 180,
        y: 360
      }
    ]);

    expect(line?.pathD).toBe("M 270 260 V 360");
    expect(line?.labelX).toBe(278);
    expect(line?.labelY).toBe(310);
  });

  it("offsets opposite lines between the same node pair", () => {
    const lines = buildLineLayouts([
      {
        from: "node-1",
        id: "line-1",
        label: "A to B",
        to: "node-2"
      },
      {
        from: "node-2",
        id: "line-2",
        label: "B to A",
        to: "node-1"
      }
    ], horizontalNodes);

    expect(lines).toHaveLength(2);
    expect(lines[0]?.pathD).toBe("M 360 210 H 440");
    expect(lines[1]?.pathD).toBe("M 440 230 H 360");
  });

  it("routes staggered opposite lines through a clean horizontal middle lane", () => {
    const lines = buildLineLayouts([
      {
        from: "node-1",
        id: "line-1",
        label: "A to B",
        to: "node-2"
      },
      {
        from: "node-2",
        id: "line-2",
        label: "B to A",
        to: "node-1"
      }
    ], [
      horizontalNodes[0],
      {
        node: horizontalNodes[1].node,
        x: 620,
        y: 360
      }
    ]);

    expect(lines[0]?.pathD).toBe("M 360 210 H 490 V 390 H 620");
    expect(lines[1]?.pathD).toBe("M 620 410 H 490 V 230 H 360");
  });

  it("routes vertically stacked opposite lines through a clean vertical middle lane", () => {
    const lines = buildLineLayouts([
      {
        from: "node-1",
        id: "line-1",
        label: "A to B",
        to: "node-2"
      },
      {
        from: "node-2",
        id: "line-2",
        label: "B to A",
        to: "node-1"
      }
    ], [
      horizontalNodes[0],
      {
        node: horizontalNodes[1].node,
        x: 260,
        y: 420
      }
    ]);

    expect(lines[0]?.pathD).toBe("M 260 260 V 340 H 340 V 420");
    expect(lines[1]?.pathD).toBe("M 360 420 V 340 H 280 V 260");
  });
});
