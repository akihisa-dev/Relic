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
  it("curves horizontal lines between node edges", () => {
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
      labelY: 238,
      pathD: "M 360 220 Q 400 256 440 220",
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
    expect(line?.pathD).toMatch(/^M .+ Q .+ .+$/);
    expect(line?.labelX).toBeCloseTo(389.75, 2);
    expect(line?.labelY).toBeCloseTo(324.8, 2);
  });

  it("curves vertical lines between node edges", () => {
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

    expect(line?.pathD).toBe("M 270 260 Q 234 310 270 360");
    expect(line?.labelX).toBe(252);
    expect(line?.labelY).toBe(310);
  });

  it("curves opposite lines to different sides of the same node pair", () => {
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
    expect(lines[0]?.pathD).toBe("M 360 220 Q 400 278 440 220");
    expect(lines[1]?.pathD).toBe("M 440 220 Q 400 162 360 220");
  });

  it("keeps staggered opposite lines as separate curves", () => {
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

    expect(lines).toHaveLength(2);
    expect(lines[0]?.pathD).toMatch(/^M .+ Q .+ .+$/);
    expect(lines[1]?.pathD).toMatch(/^M .+ Q .+ .+$/);
    expect(lines[0]?.pathD).not.toBe(lines[1]?.pathD);
  });

  it("keeps vertically stacked opposite lines as separate curves", () => {
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

    expect(lines).toHaveLength(2);
    expect(lines[0]?.pathD).toMatch(/^M .+ Q .+ .+$/);
    expect(lines[1]?.pathD).toMatch(/^M .+ Q .+ .+$/);
    expect(lines[0]?.pathD).not.toBe(lines[1]?.pathD);
  });
});
