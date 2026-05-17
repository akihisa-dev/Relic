import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GraphPoint } from "../graphLayout";
import { GraphArrowMarkers, GraphEdgeLayer, GraphNodeLayer } from "./GraphCanvasLayers";

const points: GraphPoint[] = [
  { degree: 1, folder: "", incoming: 0, name: "A", outgoing: 1, path: "A.md", tags: [], x: 80, y: 90 },
  { degree: 0, folder: "", incoming: 0, name: "B", outgoing: 0, path: "B.md", tags: [], x: 160, y: 130 },
  { degree: 1, folder: "", incoming: 1, name: "C", outgoing: 0, path: "C.md", tags: [], x: 240, y: 170 },
  { degree: 0, folder: "", incoming: 0, name: "D", outgoing: 0, path: "D.md", tags: [], x: 320, y: 210 }
];

const pointByPath = new Map(points.map((point) => [point.path, point]));

function nodeCircle(name: string): SVGCircleElement {
  const node = screen.getByRole("button", { name });
  const circle = node.querySelector("circle");
  expect(circle).not.toBeNull();
  return circle as SVGCircleElement;
}

function renderNodeLayer(overrides: Partial<Parameters<typeof GraphNodeLayer>[0]> = {}) {
  const props: Parameters<typeof GraphNodeLayer>[0] = {
    focusedPath: "A.md",
    groupByPath: new Map(),
    isMotionAfterglow: false,
    labelOpacity: 1,
    motionPath: null,
    nodeSize: 1,
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
    showLabels: true,
    ...overrides
  };

  return { ...render(<svg><GraphNodeLayer {...props} /></svg>), props };
}

describe("GraphCanvasLayers", () => {
  it("marker定義を既存idとclass名で描画する", () => {
    const { container } = render(<svg><GraphArrowMarkers /></svg>);

    expect(container.querySelector("marker#graph-arrow")).toBeInTheDocument();
    expect(container.querySelector("marker#graph-arrow-selected")).toBeInTheDocument();
    expect(container.querySelector(".graph-arrow-marker--selected")).toBeInTheDocument();
  });

  it("edge layerを既存class名とmarkerEndで描画する", () => {
    const { container } = render(
      <svg>
        <GraphEdgeLayer
          edges={[{ sourcePath: "A.md", targetPath: "C.md" }]}
          focusedPath="A.md"
          isMotionAfterglow={false}
          linkThickness={1.2}
          motionEpoch={1}
          motionPath={null}
          pointByPath={pointByPath}
          showArrows
        />
      </svg>
    );

    const edge = container.querySelector("line.graph-edge");
    expect(container.querySelector(".graph-edge-layer")).toBeInTheDocument();
    expect(edge).toHaveClass("graph-edge--selected");
    expect(edge).toHaveAttribute("marker-end", "url(#graph-arrow-selected)");
    expect(edge).toHaveStyle({ strokeWidth: "1.92" });
  });

  it("motionPathに接続するedgeへtrace overlayを描画する", () => {
    const { container } = render(
      <svg>
        <GraphEdgeLayer
          edges={[
            { sourcePath: "A.md", targetPath: "C.md" },
            { sourcePath: "B.md", targetPath: "D.md" }
          ]}
          focusedPath="A.md"
          isMotionAfterglow={true}
          linkThickness={1}
          motionEpoch={4}
          motionPath="A.md"
          pointByPath={pointByPath}
          showArrows={false}
        />
      </svg>
    );

    const traces = container.querySelectorAll("line.graph-edge-trace");
    expect(traces).toHaveLength(1);
    expect(traces[0]).toHaveClass("graph-edge-trace--afterglow");
    expect(traces[0]).toHaveAttribute("pathLength", "1");
  });

  it("node layerでselected/focused/related/dimmed classを既存通り付ける", () => {
    renderNodeLayer();

    expect(screen.getByRole("button", { name: "A" })).toHaveClass("graph-node-hit");
    expect(nodeCircle("A")).toHaveClass("graph-node--focused");
    expect(nodeCircle("B")).toHaveClass("graph-node--selected");
    expect(nodeCircle("C")).toHaveClass("graph-node--related");
    expect(nodeCircle("D")).toHaveClass("graph-node--dimmed");
    expect(screen.getByText("A")).toHaveClass("graph-label");
  });

  it("motionPathのnodeへmotion classとdelayを付ける", () => {
    renderNodeLayer({ isMotionAfterglow: true, motionPath: "A.md" });

    expect(nodeCircle("A")).toHaveClass("graph-node--motion");
    expect(nodeCircle("A")).toHaveClass("graph-node--motion-afterglow");
    expect(nodeCircle("A")).toHaveStyle({ animationDelay: "0s" });
    expect(nodeCircle("C")).not.toHaveClass("graph-node--motion");
  });

  it("node layerのclick/key callbackを接続する", () => {
    const onNodeClick = vi.fn();
    const onNodeKeyDown = vi.fn();
    renderNodeLayer({ onNodeClick, onNodeKeyDown });

    const node = screen.getByRole("button", { name: "A" });
    fireEvent.click(node);
    fireEvent.keyDown(node, { key: "Enter" });

    expect(onNodeClick).toHaveBeenCalledWith(expect.objectContaining({ path: "A.md" }));
    expect(onNodeKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: "Enter" }), expect.objectContaining({ path: "A.md" }));
  });
});
