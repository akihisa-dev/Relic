import { describe, expect, it } from "vitest";

import type { GraphPoint } from "./graphLayout";
import {
  buildGraphRenderState,
  defaultGraphRenderPalette,
  parseGraphColor
} from "./graphRenderModel";

const points: GraphPoint[] = [
  { degree: 1, folder: "", incoming: 0, name: "A", outgoing: 1, path: "A.md", tags: [], x: 80, y: 90 },
  { degree: 0, folder: "", incoming: 0, name: "B", outgoing: 0, path: "B.md", tags: [], x: 160, y: 130 },
  { degree: 1, folder: "", incoming: 1, name: "C", outgoing: 0, path: "C.md", tags: [], x: 240, y: 170 },
  { degree: 0, folder: "", incoming: 0, name: "D", outgoing: 0, path: "D.md", tags: [], x: 320, y: 210 }
];

describe("graphRenderModel", () => {
  it("hover focused/related状態を描画モデルへ持ち込まず、selectedでも強調しない", () => {
    const state = buildGraphRenderState({
      edges: [{ sourcePath: "A.md", targetPath: "C.md" }],
      focusedPath: "A.md",
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      palette: defaultGraphRenderPalette,
      points,
      relatedPaths: new Set(["A.md", "C.md"]),
      selectedPath: "B.md",
      showLabels: true
    });

    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]).toMatchObject({ isFocused: false, isMotion: false, sourcePath: "A.md", targetPath: "C.md" });
    expect(state.nodes.find((node) => node.path === "A.md")).toMatchObject({
      degree: 1,
      folder: "",
      incoming: 0,
      isFocused: false,
      labelVisible: true,
      outgoing: 1,
      tags: []
    });
    expect(state.nodes.find((node) => node.path === "B.md")).toMatchObject({ isSelected: false, ringVisible: false });
    expect(state.nodes.find((node) => node.path === "C.md")).toMatchObject({ isRelated: false });
    expect(state.nodes.find((node) => node.path === "D.md")).toMatchObject({ isDimmed: false });
    expect(state.nodes.find((node) => node.path === "A.md")?.fillColor).toBe(defaultGraphRenderPalette.node);
    expect(state.nodes.find((node) => node.path === "C.md")?.fillColor).toBe(defaultGraphRenderPalette.node);
    expect(state.nodes.find((node) => node.path === "D.md")?.fillAlpha).toBe(0.96);
    expect(state.nodes.find((node) => node.path === "D.md")?.fillColor).toBe(defaultGraphRenderPalette.node);
    expect(state.edges[0]?.alpha).toBe(0.32);
    expect(state.edges[0]?.strokeWidth).toBeCloseTo(0.78);
    expect(state.nodes.find((node) => node.path === "B.md")?.strokeWidth).toBe(0);
  });

  it("hoverしてもnode/link/labelの描画値を変えない", () => {
    const hoveredState = buildGraphRenderState({
      edges: [{ sourcePath: "A.md", targetPath: "C.md" }],
      focusedPath: "A.md",
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: "A.md",
      nodeSize: 1,
      palette: defaultGraphRenderPalette,
      points,
      relatedPaths: new Set(["A.md", "C.md"]),
      selectedPath: null,
      showLabels: true
    });
    const normalState = buildGraphRenderState({
      edges: [{ sourcePath: "A.md", targetPath: "C.md" }],
      focusedPath: null,
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      palette: defaultGraphRenderPalette,
      points,
      relatedPaths: new Set(),
      selectedPath: null,
      showLabels: true
    });

    expect(hoveredState.edges[0]).toMatchObject({
      alpha: 0.32,
      color: defaultGraphRenderPalette.line,
      isFocused: false,
      isMotion: false,
      strokeWidth: 0.78
    });
    expect(hoveredState.edges.map(({ alpha, color, strokeWidth, x1, x2, y1, y2 }) => ({ alpha, color, strokeWidth, x1, x2, y1, y2 })))
      .toEqual(normalState.edges.map(({ alpha, color, strokeWidth, x1, x2, y1, y2 }) => ({ alpha, color, strokeWidth, x1, x2, y1, y2 })));
    expect(hoveredState.nodes.map(({ fillAlpha, fillColor, labelAlpha, labelVisible, radius, strokeAlpha, strokeColor, strokeWidth }) => ({
      fillAlpha,
      fillColor,
      labelAlpha,
      labelVisible,
      radius,
      strokeAlpha,
      strokeColor,
      strokeWidth
    }))).toEqual(normalState.nodes.map(({ fillAlpha, fillColor, labelAlpha, labelVisible, radius, strokeAlpha, strokeColor, strokeWidth }) => ({
      fillAlpha,
      fillColor,
      labelAlpha,
      labelVisible,
      radius,
      strokeAlpha,
      strokeColor,
      strokeWidth
    })));
  });

  it("group colorと均一なnode radiusを反映する", () => {
    const state = buildGraphRenderState({
      edges: [],
      focusedPath: null,
      groupByPath: new Map([["A.md", { color: "#8b5cf6", id: "group", query: "A" }]]),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      points,
      relatedPaths: new Set(),
      selectedPath: null,
      showLabels: true
    });

    const grouped = state.nodes.find((node) => node.path === "A.md");
    const orphan = state.nodes.find((node) => node.path === "B.md");
    expect(grouped?.fillColor).toBe(0x8b5cf6);
    expect(grouped?.radius).toBe(orphan?.radius);
  });

  it("default paletteは通常node/linkをObsidian風のneutral grayで描く", () => {
    const state = buildGraphRenderState({
      edges: [{ sourcePath: "A.md", targetPath: "C.md" }],
      focusedPath: null,
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      palette: defaultGraphRenderPalette,
      points,
      relatedPaths: new Set(),
      selectedPath: null,
      showLabels: true
    });

    expect(state.nodes.find((node) => node.path === "A.md")?.fillColor).toBe(defaultGraphRenderPalette.node);
    expect(state.edges[0]?.color).toBe(defaultGraphRenderPalette.line);
    expect(state.edges[0]?.alpha).toBeLessThan(0.36);
  });

  it("大規模グラフでは読めるズーム距離でhoverなしでもラベルを表示する", () => {
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
    const state = buildGraphRenderState({
      edges: [],
      focusedPath: "N0.md",
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      points: manyPoints,
      relatedPaths: new Set(["N0.md", "N1.md"]),
      selectedPath: "N0.md",
      showLabels: true
    });

    expect(state.nodes.find((node) => node.path === "N0.md")?.labelVisible).toBe(false);
    expect(state.nodes.find((node) => node.path === "N1.md")?.labelVisible).toBe(false);
    expect(state.nodes.find((node) => node.path === "N2.md")?.labelVisible).toBe(false);
    expect(state.nodes.find((node) => node.path === "N2.md")?.radius).toBeCloseTo(1.82);
    expect(state.nodes.find((node) => node.path === "N2.md")?.fillAlpha).toBeLessThan(0.9);
    expect(state.nodes.find((node) => node.path === "N2.md")?.strokeAlpha).toBe(0);

    const hoveredState = buildGraphRenderState({
      edges: [],
      focusedPath: "N0.md",
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: "N0.md",
      nodeSize: 1,
      points: manyPoints,
      relatedPaths: new Set(["N0.md", "N1.md"]),
      selectedPath: null,
      showLabels: true,
      viewScale: 1
    });

    expect(hoveredState.nodes.find((node) => node.path === "N0.md")?.labelVisible).toBe(false);
    expect(hoveredState.nodes.find((node) => node.path === "N1.md")?.labelVisible).toBe(false);
    expect(hoveredState.nodes.find((node) => node.path === "N2.md")?.labelVisible).toBe(false);

    const spacedPoints = manyPoints.map((point, index) => ({
      ...point,
      x: (index % 20) * 14,
      y: Math.floor(index / 20) * 10
    }));
    const zoomedState = buildGraphRenderState({
      edges: [],
      focusedPath: null,
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      points: spacedPoints,
      relatedPaths: new Set(),
      selectedPath: "N0.md",
      showLabels: true,
      viewScale: 3
    });
    const hoveredZoomedState = buildGraphRenderState({
      edges: [],
      focusedPath: "N17.md",
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: "N17.md",
      nodeSize: 1,
      points: spacedPoints,
      relatedPaths: new Set(["N17.md"]),
      selectedPath: null,
      showLabels: true,
      viewScale: 3
    });

    expect(zoomedState.nodes.find((node) => node.path === "N0.md")?.labelVisible).toBe(true);
    expect(zoomedState.nodes.some((node) => node.labelVisible)).toBe(true);
    expect(zoomedState.nodes.filter((node) => node.labelVisible).length).toBeLessThan(zoomedState.nodes.length);
    expect(hoveredZoomedState.nodes.map((node) => node.labelVisible)).toEqual(zoomedState.nodes.map((node) => node.labelVisible));
  });

  it("大規模グラフではズームに応じてlinkとnodeをLOD調整する", () => {
    const manyPoints = Array.from({ length: 230 }, (_, index): GraphPoint => ({
      degree: index < 2 ? 1 : 0,
      folder: "",
      incoming: index === 1 ? 1 : 0,
      name: `N${index}`,
      outgoing: index === 0 ? 1 : 0,
      path: `N${index}.md`,
      tags: [],
      x: index,
      y: index
    }));
    const farState = buildGraphRenderState({
      edges: [{ sourcePath: "N0.md", targetPath: "N1.md" }],
      focusedPath: null,
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      points: manyPoints,
      relatedPaths: new Set(),
      selectedPath: null,
      showLabels: true,
      viewScale: 0.7
    });
    const nearState = buildGraphRenderState({
      edges: [{ sourcePath: "N0.md", targetPath: "N1.md" }],
      focusedPath: null,
      groupByPath: new Map(),
      labelOpacity: 1,
      linkThickness: 1,
      motionPath: null,
      nodeSize: 1,
      points: manyPoints,
      relatedPaths: new Set(),
      selectedPath: null,
      showLabels: true,
      viewScale: 3
    });

    expect(farState.edges[0]?.alpha).toBeLessThan(nearState.edges[0]?.alpha ?? 0);
    expect((farState.edges[0]?.strokeWidth ?? 0) * 0.7).toBeLessThan((nearState.edges[0]?.strokeWidth ?? 0) * 3);
    expect(farState.nodes[0]?.fillAlpha).toBeLessThan(nearState.nodes[0]?.fillAlpha ?? 0);
    expect((farState.nodes[0]?.radius ?? 0) * 0.7).toBeLessThan((nearState.nodes[0]?.radius ?? 0) * 3);
  });

  it("ズーム時のnode radiusをObsidian風のベタ丸サイズへ拡大する", () => {
    const normal = buildGraphRenderState({
      edges: [],
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
    const zoomed = buildGraphRenderState({
      edges: [],
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
      viewScale: 2.56
    });

    expect(normal.nodes[0]?.radius).toBeCloseTo(3.1);
    expect(zoomed.nodes[0]?.radius * 2.56).toBeCloseTo(4.96);
    expect(zoomed.nodes[0]?.strokeWidth).toBe(0);
  });

  it("CSS color文字列をPixi用numberへ変換する", () => {
    expect(parseGraphColor("#0ea5e9", 0)).toBe(0x0ea5e9);
    expect(parseGraphColor("#abc", 0)).toBe(0xaabbcc);
    expect(parseGraphColor("rgb(1, 2, 3)", 0)).toBe(0x010203);
    expect(parseGraphColor("not-a-color", 0x123456)).toBe(0x123456);
  });
});
