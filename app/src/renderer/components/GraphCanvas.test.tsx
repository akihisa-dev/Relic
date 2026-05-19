import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GRAPH_HEIGHT, GRAPH_WIDTH, type GraphPoint } from "../graphLayout";
import { buildGraphViewBoxTransform, GraphCanvas, type GraphCanvasProps } from "./GraphCanvas";

const points: GraphPoint[] = [
  { degree: 1, folder: "", incoming: 0, name: "A", outgoing: 1, path: "A.md", tags: [], x: 80, y: 90 },
  { degree: 0, folder: "", incoming: 0, name: "B", outgoing: 0, path: "B.md", tags: [], x: 160, y: 130 },
  { degree: 1, folder: "", incoming: 1, name: "C", outgoing: 0, path: "C.md", tags: [], x: 240, y: 170 },
  { degree: 0, folder: "", incoming: 0, name: "D", outgoing: 0, path: "D.md", tags: [], x: 320, y: 210 }
];

function makeGraphCanvasProps(overrides: Partial<GraphCanvasProps> = {}): GraphCanvasProps {
  return {
    edges: [{ sourcePath: "A.md", targetPath: "C.md" }],
    focusedPath: "A.md",
    groupByPath: new Map(),
    isMotionAfterglow: false,
    isPanning: false,
    labelOpacity: 1,
    linkThickness: 1,
    motionEpoch: 0,
    motionPath: null,
    nodeSize: 1,
    onGraphKeyDown: vi.fn(),
    onGraphPointerCancel: vi.fn(),
    onGraphPointerDown: vi.fn(),
    onGraphPointerMove: vi.fn(),
    onGraphPointerUp: vi.fn(),
    onGraphWheel: vi.fn(),
    onNodeClick: vi.fn(),
    onNodeKeyDown: vi.fn(),
    onNodePointerCancel: vi.fn(),
    onNodePointerDown: vi.fn(),
    onNodePointerEnter: vi.fn(),
    onNodePointerLeave: vi.fn(),
    onNodePointerMove: vi.fn(),
    onNodePointerUp: vi.fn(),
    points,
    relatedPaths: new Set(["A.md", "C.md"]),
    selectedPath: "B.md",
    showArrows: false,
    showLabels: true,
    surfaceRef: createRef<HTMLDivElement>(),
    viewBox: { height: GRAPH_HEIGHT, width: GRAPH_WIDTH, x: 0, y: 0 },
    ...overrides
  };
}

function renderGraphCanvas(overrides: Partial<GraphCanvasProps> = {}): RenderResult & { props: GraphCanvasProps } {
  const props = makeGraphCanvasProps(overrides);
  return { ...render(<GraphCanvas {...props} />), props };
}

describe("GraphCanvas", () => {
  it("Pixi screen sizeからviewBox transformを作りdevicePixelRatioで二重に縮小しない", () => {
    const transform = buildGraphViewBoxTransform(1200, 720, { height: 900, width: 1600, x: 0, y: 0 });

    expect(transform.scaleX).toBeCloseTo(0.75);
    expect(transform.scaleY).toBeCloseTo(0.8);
    expect(transform.x).toBeCloseTo(0);
    expect(transform.y).toBeCloseTo(0);
  });

  it("Pixi rendererのhostを描画しnode/edge件数を属性へ反映する", () => {
    renderGraphCanvas();

    const surface = screen.getByRole("img", { name: "Graph" });
    expect(surface).toHaveClass("graph-pixi-surface");
    expect(surface).toHaveAttribute("data-renderer", "pixi");
    expect(surface).toHaveAttribute("data-node-count", "4");
    expect(surface).toHaveAttribute("data-edge-count", "1");
  });

  it("大規模グラフでは軽量表示classを付ける", () => {
    const manyPoints = Array.from({ length: 221 }, (_, index): GraphPoint => ({
      degree: 0,
      folder: "",
      incoming: 0,
      name: `N${index}`,
      outgoing: 0,
      path: `N${index}.md`,
      tags: [],
      x: index,
      y: index
    }));

    renderGraphCanvas({ points: manyPoints });

    expect(screen.getByRole("img", { name: "Graph" })).toHaveClass("graph-pixi-surface--large");
  });

  it("surface上のkeyboard、pointer、wheel callbackを接続する", () => {
    const onGraphKeyDown = vi.fn();
    const onGraphPointerDown = vi.fn();
    const onGraphWheel = vi.fn();
    renderGraphCanvas({ onGraphKeyDown, onGraphPointerDown, onGraphWheel });

    const surface = screen.getByRole("img", { name: "Graph" });
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    fireEvent.pointerDown(surface, { button: 0, pointerId: 1 });
    fireEvent.wheel(surface, { deltaY: -100 });

    expect(onGraphKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "ArrowRight" }));
    expect(onGraphPointerDown).toHaveBeenCalled();
    expect(onGraphWheel).toHaveBeenCalledWith(expect.objectContaining({ deltaY: -100 }));
  });

  it("Enter keyではfocused nodeのkey handlerを呼ぶ", () => {
    const onNodeKeyDown = vi.fn();
    renderGraphCanvas({ focusedPath: "A.md", onNodeKeyDown });

    fireEvent.keyDown(screen.getByRole("img", { name: "Graph" }), { key: "Enter" });

    expect(onNodeKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }), expect.objectContaining({ path: "A.md" }));
  });
});
