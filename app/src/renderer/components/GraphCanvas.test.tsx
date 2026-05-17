import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphPoint } from "../graphLayout";
import { GraphCanvas, type GraphCanvasProps } from "./GraphCanvas";

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
    svgRef: createRef<SVGSVGElement>(),
    viewBox: { height: 520, width: 720, x: 0, y: 0 },
    ...overrides
  };
}

function renderGraphCanvas(overrides: Partial<GraphCanvasProps> = {}): RenderResult & { props: GraphCanvasProps } {
  const props = makeGraphCanvasProps(overrides);
  return { ...render(<GraphCanvas {...props} />), props };
}

function nodeCircle(name: string): SVGCircleElement {
  const node = screen.getByRole("button", { name });
  const circle = node.querySelector("circle");
  expect(circle).not.toBeNull();
  return circle as SVGCircleElement;
}

describe("GraphCanvas", () => {
  it("edgeとnodeを既存class名で描画する", () => {
    const { container } = renderGraphCanvas();

    expect(container.querySelector("svg.graph-svg")).toBeInTheDocument();
    expect(container.querySelector(".graph-edge-layer .graph-edge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "A" })).toHaveClass("graph-node-hit");
    expect(nodeCircle("A")).toHaveClass("graph-node");
    expect(screen.getByText("A")).toHaveClass("graph-label");
  });

  it("motionPathがあるとtrace overlayを描画する", () => {
    const { container } = renderGraphCanvas({ motionEpoch: 2, motionPath: "A.md" });

    expect(container.querySelector("line.graph-edge-trace")).toBeInTheDocument();
  });

  it("showArrows=trueでmarker定義とmarkerEndを描画する", () => {
    const { container } = renderGraphCanvas({ showArrows: true });

    expect(container.querySelector("marker#graph-arrow")).toBeInTheDocument();
    expect(container.querySelector("marker#graph-arrow-selected")).toBeInTheDocument();
    expect(container.querySelector("line.graph-edge")).toHaveAttribute("marker-end", "url(#graph-arrow-selected)");
  });

  it("selected、focused、related、dimmedのnode classを既存通り付ける", () => {
    renderGraphCanvas();

    expect(nodeCircle("A")).toHaveClass("graph-node--focused");
    expect(nodeCircle("B")).toHaveClass("graph-node--selected");
    expect(nodeCircle("C")).toHaveClass("graph-node--related");
    expect(nodeCircle("D")).toHaveClass("graph-node--dimmed");
  });

  it("node clickとEnter keyで渡したcallbackを呼ぶ", () => {
    const onNodeClick = vi.fn();
    const onNodeKeyDown = vi.fn();
    renderGraphCanvas({ onNodeClick, onNodeKeyDown });

    const node = screen.getByRole("button", { name: "A" });
    fireEvent.click(node);
    fireEvent.keyDown(node, { key: "Enter" });

    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ path: "A.md" }));
    expect(onNodeKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }), expect.objectContaining({ path: "A.md" }));
  });
});
