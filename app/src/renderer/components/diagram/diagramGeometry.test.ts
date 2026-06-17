import { describe, expect, it } from "vitest";

import { buildLineLayouts, visibleDiagramLines, type DiagramCanvasNodeLayout } from "./diagramGeometry";

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
  const tokens = pathD.match(/[A-Z]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < tokens.length;) {
    const command = tokens[index];
    if (command === "M" || command === "L") {
      const x = Number(tokens[index + 1]);
      const y = Number(tokens[index + 2]);
      points.push({ x, y });
      index += 3;
      continue;
    }
    if (command === "C") {
      const x = Number(tokens[index + 5]);
      const y = Number(tokens[index + 6]);
      points.push({ x, y });
      index += 7;
      continue;
    }
    index += 1;
  }

  return points;
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

  it("draws a jump on the vertical segment where relationship lines cross", () => {
    const lines = buildLineLayouts([
      {
        from: "left",
        id: "line-horizontal",
        label: "horizontal",
        to: "right"
      },
      {
        from: "top",
        id: "line-vertical",
        label: "vertical",
        to: "bottom"
      }
    ], [
      {
        node: {
          file: "left.md",
          height: 80,
          id: "left",
          width: 180,
          x: 80,
          y: 180
        },
        x: 80,
        y: 180
      },
      {
        node: {
          file: "right.md",
          height: 80,
          id: "right",
          width: 180,
          x: 520,
          y: 180
        },
        x: 520,
        y: 180
      },
      {
        node: {
          file: "top.md",
          height: 80,
          id: "top",
          width: 180,
          x: 300,
          y: 40
        },
        x: 300,
        y: 40
      },
      {
        node: {
          file: "bottom.md",
          height: 80,
          id: "bottom",
          width: 180,
          x: 300,
          y: 360
        },
        x: 300,
        y: 360
      }
    ]);

    const horizontal = lines.find((line) => line.line.id === "line-horizontal");
    const vertical = lines.find((line) => line.line.id === "line-vertical");

    expect(horizontal?.pathD).not.toContain(" C ");
    expect(vertical?.pathD).toContain(" C ");
    expect(vertical?.pathD).toContain("L 390 208 C 404 208 404 232 390 232");
    expect(horizontal?.labelX).toBe(297);
    expect(horizontal?.labelY).toBe(220);
    expect(vertical?.labelX).toBe(390);
    expect(vertical?.labelY).toBe(318);
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
    expect(firstPoints[0]).toEqual({ x: lines[0]?.x1, y: lines[0]?.y1 });
    expect(firstPoints.at(-1)).toEqual({ x: lines[0]?.x2, y: lines[0]?.y2 });
    expect(secondPoints[0]).toEqual({ x: lines[1]?.x1, y: lines[1]?.y1 });
    expect(secondPoints.at(-1)).toEqual({ x: lines[1]?.x2, y: lines[1]?.y2 });
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

  it("merges incoming decision lines into one averaged input corner", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          height: 120,
          id: "decision",
          layer: 1,
          shape: "decision",
          text: "判断",
          width: 160,
          x: 300,
          y: 200
        },
        x: 300,
        y: 200
      },
      {
        node: {
          height: 80,
          id: "left-top",
          layer: 1,
          shape: "process",
          text: "上流",
          width: 120,
          x: 40,
          y: 120
        },
        x: 40,
        y: 120
      },
      {
        node: {
          height: 80,
          id: "left-bottom",
          layer: 1,
          shape: "process",
          text: "下流",
          width: 120,
          x: 40,
          y: 320
        },
        x: 40,
        y: 320
      }
    ];

    const lines = buildLineLayouts([
      {
        from: "left-top",
        id: "line-1",
        label: "A",
        to: "decision"
      },
      {
        from: "left-bottom",
        id: "line-2",
        label: "B",
        to: "decision"
      }
    ], nodes);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ x2: 300, y2: 260 });
    expect(lines[1]).toMatchObject({ x2: 300, y2: 260 });
  });

  it("keeps decision output corners away from the reserved input corner", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          height: 120,
          id: "decision",
          layer: 1,
          shape: "decision",
          text: "判断",
          width: 160,
          x: 300,
          y: 200
        },
        x: 300,
        y: 200
      },
      {
        node: {
          height: 80,
          id: "right-input",
          layer: 1,
          shape: "process",
          text: "入力",
          width: 120,
          x: 620,
          y: 220
        },
        x: 620,
        y: 220
      },
      {
        node: {
          height: 80,
          id: "right-output",
          layer: 1,
          shape: "process",
          text: "出力",
          width: 120,
          x: 620,
          y: 360
        },
        x: 620,
        y: 360
      }
    ];

    const lines = buildLineLayouts([
      {
        from: "right-input",
        id: "line-in",
        label: "in",
        to: "decision"
      },
      {
        from: "decision",
        id: "line-out",
        label: "out",
        to: "right-output"
      }
    ], nodes);

    const incoming = lines.find((line) => line.line.id === "line-in");
    const outgoing = lines.find((line) => line.line.id === "line-out");

    expect(incoming).toMatchObject({ x2: 460, y2: 260 });
    expect(outgoing).toMatchObject({ x1: 380, y1: 320 });
    expect(outgoing).not.toMatchObject({ x1: 460, y1: 260 });
  });

  it("uses any natural decision output corner when no input corner is reserved", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          height: 120,
          id: "decision",
          layer: 1,
          shape: "decision",
          text: "判断",
          width: 160,
          x: 300,
          y: 200
        },
        x: 300,
        y: 200
      },
      {
        node: {
          height: 80,
          id: "right-output",
          layer: 1,
          shape: "process",
          text: "出力",
          width: 120,
          x: 620,
          y: 220
        },
        x: 620,
        y: 220
      }
    ];

    const [line] = buildLineLayouts([
      {
        from: "decision",
        id: "line-out",
        label: "out",
        to: "right-output"
      }
    ], nodes);

    expect(line).toMatchObject({ x1: 460, y1: 260 });
  });

  it("uses separate output corners for two decision outgoing lines", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          height: 120,
          id: "decision",
          layer: 1,
          shape: "decision",
          text: "判断",
          width: 160,
          x: 300,
          y: 200
        },
        x: 300,
        y: 200
      },
      {
        node: {
          height: 80,
          id: "input",
          layer: 1,
          shape: "process",
          text: "入力",
          width: 120,
          x: 40,
          y: 220
        },
        x: 40,
        y: 220
      },
      {
        node: {
          height: 80,
          id: "target-left-bottom",
          layer: 1,
          shape: "process",
          text: "左下",
          width: 120,
          x: 120,
          y: 480
        },
        x: 120,
        y: 480
      },
      {
        node: {
          height: 80,
          id: "target-right-bottom",
          layer: 1,
          shape: "process",
          text: "右下",
          width: 120,
          x: 620,
          y: 480
        },
        x: 620,
        y: 480
      }
    ];

    const lines = buildLineLayouts([
      {
        from: "input",
        id: "line-in",
        label: "in",
        to: "decision"
      },
      {
        from: "decision",
        id: "line-yes",
        label: "はい",
        to: "target-left-bottom"
      },
      {
        from: "decision",
        id: "line-no",
        label: "いいえ",
        to: "target-right-bottom"
      }
    ], nodes);

    const yesLine = lines.find((line) => line.line.id === "line-yes");
    const noLine = lines.find((line) => line.line.id === "line-no");

    expect(yesLine).toMatchObject({ x1: 380, y1: 320 });
    expect(noLine).toMatchObject({ x1: 460, y1: 260 });
    expect(`${yesLine?.x1},${yesLine?.y1}`).not.toBe(`${noLine?.x1},${noLine?.y1}`);
  });

  it("hides the third and later outgoing decision lines from layout targets", () => {
    const nodes: DiagramCanvasNodeLayout[] = [
      {
        node: {
          height: 120,
          id: "decision",
          layer: 1,
          shape: "decision",
          text: "判断",
          width: 160,
          x: 300,
          y: 200
        },
        x: 300,
        y: 200
      },
      {
        node: {
          height: 80,
          id: "target-1",
          layer: 1,
          shape: "process",
          text: "A",
          width: 120,
          x: 620,
          y: 80
        },
        x: 620,
        y: 80
      },
      {
        node: {
          height: 80,
          id: "target-2",
          layer: 1,
          shape: "process",
          text: "B",
          width: 120,
          x: 620,
          y: 220
        },
        x: 620,
        y: 220
      },
      {
        node: {
          height: 80,
          id: "target-3",
          layer: 1,
          shape: "process",
          text: "C",
          width: 120,
          x: 620,
          y: 360
        },
        x: 620,
        y: 360
      }
    ];
    const lines = [
      {
        from: "decision",
        id: "line-1",
        label: "はい",
        to: "target-1"
      },
      {
        from: "decision",
        id: "line-2",
        label: "いいえ",
        to: "target-2"
      },
      {
        from: "decision",
        id: "line-3",
        label: "選択肢3",
        to: "target-3"
      }
    ];

    expect(visibleDiagramLines(lines, nodes.map((node) => node.node)).map((line) => line.id)).toEqual([
      "line-1",
      "line-2"
    ]);
    expect(buildLineLayouts(lines, nodes).map((line) => line.line.id)).toEqual([
      "line-1",
      "line-2"
    ]);
  });
});
