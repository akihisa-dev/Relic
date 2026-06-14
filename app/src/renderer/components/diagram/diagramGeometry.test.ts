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

function pathPoints(pathD: string): Array<{ x: number; y: number }> {
  return pathD
    .split(" L ")
    .map((part) => part.replace(/^M /, ""))
    .map((part) => {
      const [x, y] = part.split(" ").map(Number);
      return { x: x ?? 0, y: y ?? 0 };
    });
}

describe("buildLineLayouts", () => {
  it("connects a single horizontal line with a straight path", () => {
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
      labelY: 220,
      pathD: "M 360 220 L 440 220",
      x1: 360,
      x2: 440,
      y1: 220,
      y2: 220
    });
  });

  it("connects diagonal lines with perpendicular node edge segments", () => {
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

    expect(line).toMatchObject({
      x1: 270,
      x2: 530,
      y1: 260,
      y2: 360
    });
    const points = pathPoints(line?.pathD ?? "");
    expect(points[0]).toEqual({ x: 270, y: 260 });
    expect(points[1]?.x).toBe(270);
    expect(points.at(-2)?.x).toBe(530);
    expect(points.at(-1)).toEqual({ x: 530, y: 360 });
  });

  it("connects a single vertical line with a straight path", () => {
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

    expect(line?.pathD).toBe("M 270 260 L 270 360");
    expect(line?.labelX).toBe(270);
    expect(line?.labelY).toBe(310);
  });

  it("routes opposite lines as separate orthogonal paths", () => {
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
    expect(lines[0]?.pathD).toBe("M 360 208 L 440 208");
    expect(lines[1]?.pathD).toBe("M 440 232 L 360 232");
  });

  it("separates ports on the same node edge when line destinations differ", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          file: "top.md",
          height: 320,
          id: "top",
          width: 480,
          x: 64,
          y: 64
        },
        x: 64,
        y: 64
      },
      {
        node: {
          file: "left.md",
          height: 224,
          id: "left",
          width: 480,
          x: 64,
          y: 608
        },
        x: 64,
        y: 608
      },
      {
        node: {
          file: "right.md",
          height: 224,
          id: "right",
          width: 480,
          x: 640,
          y: 608
        },
        x: 640,
        y: 608
      }
    ];

    const lines = buildLineLayouts([
      {
        from: "left",
        id: "line-1",
        label: "left to top",
        to: "top"
      },
      {
        from: "top",
        id: "line-2",
        label: "top to right",
        to: "right"
      }
    ], nodes);

    expect(lines).toHaveLength(2);
    expect(lines[0]?.x2).toBe(292);
    expect(lines[1]?.x1).toBe(316);
    expect(lines[0]?.x2).not.toBe(lines[1]?.x1);
  });

  it("allows lines with the same destination to share a destination port", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          file: "top.md",
          height: 320,
          id: "top",
          width: 480,
          x: 64,
          y: 64
        },
        x: 64,
        y: 64
      },
      {
        node: {
          file: "left.md",
          height: 224,
          id: "left",
          width: 480,
          x: 64,
          y: 608
        },
        x: 64,
        y: 608
      },
      {
        node: {
          file: "right.md",
          height: 224,
          id: "right",
          width: 480,
          x: 640,
          y: 608
        },
        x: 640,
        y: 608
      }
    ];

    const lines = buildLineLayouts([
      {
        from: "left",
        id: "line-1",
        label: "left to top",
        to: "top"
      },
      {
        from: "right",
        id: "line-2",
        label: "right to top",
        to: "top"
      }
    ], nodes);

    expect(lines).toHaveLength(2);
    expect(lines[0]?.x2).toBe(304);
    expect(lines[1]?.x2).toBe(304);
    expect(lines[0]?.y2).toBe(lines[1]?.y2);
  });

  it("keeps staggered opposite lines as separate orthogonal paths", () => {
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

    const firstPoints = pathPoints(lines[0]?.pathD ?? "");
    const secondPoints = pathPoints(lines[1]?.pathD ?? "");

    expect(lines).toHaveLength(2);
    expect(lines[0]?.pathD).not.toBe(lines[1]?.pathD);
    expect(firstPoints[0]?.y).toBe(firstPoints[1]?.y);
    expect(firstPoints.at(-2)?.y).toBe(firstPoints.at(-1)?.y);
    expect(secondPoints[0]?.y).toBe(secondPoints[1]?.y);
    expect(secondPoints.at(-2)?.y).toBe(secondPoints.at(-1)?.y);
  });

  it("keeps vertically stacked opposite lines as separate orthogonal paths", () => {
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
    expect(lines[0]?.pathD).toMatch(/^M .+ L .+$/);
    expect(lines[1]?.pathD).toMatch(/^M .+ L .+$/);
    expect(lines[0]?.pathD).not.toBe(lines[1]?.pathD);
  });

  it("routes a single line around an intervening node", () => {
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
        x: 700,
        y: 180
      },
      {
        node: {
          file: "middle.md",
          height: 120,
          id: "node-3",
          width: 120,
          x: 440,
          y: 160
        },
        x: 440,
        y: 160
      }
    ]);

    expect(line?.pathD).toBe("M 360 220 L 388 220 L 388 132 L 672 132 L 672 220 L 700 220");
  });
});
