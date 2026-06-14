import { describe, expect, it } from "vitest";

import { snapDiagramNode, snapDiagramPointToGrid } from "./diagramSnap";
import { type DiagramCanvasNodeLayout } from "./diagramGeometry";

const nodes: DiagramCanvasNodeLayout[] = [
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

describe("snapDiagramNode", () => {
  it("snaps moving node edges to nearby node edges", () => {
    const snapped = snapDiagramNode("node-1", 202, 80, 180, 80, nodes);

    expect(snapped.x).toBe(200);
    expect(snapped.y).toBe(80);
    expect(snapped.guides).toContainEqual({ axis: "x", value: 380 });
  });

  it("does not snap when no target is close enough", () => {
    const snapped = snapDiagramNode("node-1", 230, 132, 180, 80, nodes);

    expect(snapped).toEqual({
      guides: [],
      x: 230,
      y: 132
    });
  });
});

describe("snapDiagramPointToGrid", () => {
  it("snaps coordinates to the 32px diagram grid", () => {
    expect(snapDiagramPointToGrid(159, 95)).toEqual({
      x: 160,
      y: 96
    });
  });
});
