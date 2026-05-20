import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GRAPH_HEIGHT, GRAPH_WIDTH, type GraphPoint } from "../graphLayout";
import { buildGraphRenderState } from "../graphRenderModel";
import {
  buildGraphRevealState,
  buildGraphLabelPlacement,
  buildGraphNodeHitRadius,
  buildGraphViewBoxTransform,
  GraphCanvas,
  graphRenderReasonsNeedLayerRedraw,
  graphViewScaleBucket,
  type GraphCanvasProps
} from "./GraphCanvas";

const points: GraphPoint[] = [
  { degree: 1, folder: "", incoming: 0, name: "A", outgoing: 1, path: "A.md", tags: [], x: 80, y: 90 },
  { degree: 0, folder: "", incoming: 0, name: "B", outgoing: 0, path: "B.md", tags: [], x: 160, y: 130 },
  { degree: 1, folder: "", incoming: 1, name: "C", outgoing: 0, path: "C.md", tags: [], x: 240, y: 170 },
  { degree: 0, folder: "", incoming: 0, name: "D", outgoing: 0, path: "D.md", tags: [], x: 320, y: 210 }
];

function makeGraphCanvasProps(overrides: Partial<GraphCanvasProps> = {}): GraphCanvasProps {
  return {
    animationEpoch: 0,
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
    pointsRef: { current: points.map((point) => ({ ...point, vx: 0, vy: 0 })) },
    relatedPaths: new Set(["A.md", "C.md"]),
    selectedPath: "B.md",
    showArrows: false,
    showLabels: true,
    surfaceRef: createRef<HTMLDivElement>(),
    viewportController: {
      liveViewBoxRef: { current: { height: GRAPH_HEIGHT, width: GRAPH_WIDTH, x: 0, y: 0 } },
      subscribe: () => () => undefined
    },
    viewBox: { height: GRAPH_HEIGHT, width: GRAPH_WIDTH, x: 0, y: 0 },
    ...overrides
  };
}

function renderGraphCanvas(overrides: Partial<GraphCanvasProps> = {}): RenderResult & { props: GraphCanvasProps } {
  const props = makeGraphCanvasProps(overrides);
  return { ...render(<GraphCanvas {...props} />), props };
}

describe("GraphCanvas", () => {
  it("Pixi screen sizeから等倍viewBox transformを作りnodeを楕円化しない", () => {
    const transform = buildGraphViewBoxTransform(1200, 720, { height: 900, width: 1600, x: 0, y: 0 });

    expect(transform.scaleX).toBeCloseTo(0.75);
    expect(transform.scaleY).toBeCloseTo(0.75);
    expect(transform.x).toBeCloseTo(0);
    expect(transform.y).toBeCloseTo(22.5);
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

  it("labelをnode直下の中央近くへ配置する", () => {
    expect(buildGraphLabelPlacement({ radius: 12, x: 120, y: 80 }, 4)).toEqual({
      x: 120,
      y: 92.5
    });
  });

  it("hit判定半径をズーム後の画面サイズ基準で作る", () => {
    expect(buildGraphNodeHitRadius(12, 1)).toBe(16);
    expect(buildGraphNodeHitRadius(0.3, 40)).toBe(0.4);
  });

  it("camera-only dirtyではnode/link/label layerを再描画しない", () => {
    expect(graphRenderReasonsNeedLayerRedraw(new Set(["camera"]))).toBe(false);
    expect(graphRenderReasonsNeedLayerRedraw(new Set(["geometry"]))).toBe(true);
    expect(graphRenderReasonsNeedLayerRedraw(new Set(["style"]))).toBe(true);
    expect(graphRenderReasonsNeedLayerRedraw(new Set(["reveal"]))).toBe(true);
  });

  it("zoom scaleを粗いbucketへ丸めてLOD再計算頻度を抑える", () => {
    expect(graphViewScaleBucket(0.6)).toBe("far");
    expect(graphViewScaleBucket(1)).toBe("default");
    expect(graphViewScaleBucket(2)).toBe("near");
    expect(graphViewScaleBucket(3)).toBe("label");
    expect(graphViewScaleBucket(5)).toBe("detail");
  });

  it("animation開始時は空の状態からnodeとlinkを順に表示するreveal stateを作る", () => {
    const state = buildGraphRenderState({
      edges: [{ sourcePath: "A.md", targetPath: "C.md" }],
      focusedPath: null,
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      points,
      relatedPaths: new Set(),
      selectedPath: null,
      showLabels: true,
      viewScale: 1
    });
    const start = buildGraphRevealState(state, 0);
    const firstNodeFrame = buildGraphRevealState(state, 13);
    const secondNodeFrame = buildGraphRevealState(state, 27);
    const firstLinkFrame = buildGraphRevealState(state, 72);
    const end = buildGraphRevealState(state, 2000);

    expect(start.nodes.every((node) => node.fillAlpha === 0 && node.radius === 0)).toBe(true);
    expect(start.edges[0]).toMatchObject({
      alpha: 0,
      strokeWidth: 0,
      x2: start.edges[0]?.x1,
      y2: start.edges[0]?.y1
    });
    expect(firstNodeFrame.nodes[0]?.fillAlpha).toBeGreaterThan(0);
    expect(firstNodeFrame.nodes[1]?.fillAlpha).toBe(0);
    expect(secondNodeFrame.nodes[1]?.fillAlpha).toBeGreaterThan(0);
    expect(secondNodeFrame.nodes[2]?.fillAlpha).toBe(0);
    expect(secondNodeFrame.edges[0]?.alpha).toBe(0);
    expect(firstLinkFrame.nodes[2]?.fillAlpha).toBeGreaterThan(0);
    expect(firstLinkFrame.edges[0]?.alpha).toBeGreaterThan(0);
    expect(firstLinkFrame.edges[0]?.x2).toBeLessThan(state.edges[0]?.x2 ?? 0);
    expect(end.nodes[0]?.fillAlpha).toBeCloseTo(state.nodes[0]?.fillAlpha ?? 0);
    expect(end.nodes[0]?.radius).toBeCloseTo(state.nodes[0]?.radius ?? 0);
    expect(end.edges[0]?.alpha).toBeCloseTo(state.edges[0]?.alpha ?? 0);
    expect(end.edges[0]?.strokeWidth).toBeCloseTo(state.edges[0]?.strokeWidth ?? 0);
    expect(end.edges[0]?.x2).toBeCloseTo(state.edges[0]?.x2 ?? 0);
    expect(end.edges[0]?.y2).toBeCloseTo(state.edges[0]?.y2 ?? 0);
  });
});
