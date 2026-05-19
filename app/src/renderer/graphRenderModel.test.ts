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
  it("selected/focused/related/dimmed状態を描画モデルへ反映する", () => {
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
    expect(state.edges[0]).toMatchObject({ isFocused: true, sourcePath: "A.md", targetPath: "C.md" });
    expect(state.nodes.find((node) => node.path === "A.md")).toMatchObject({
      degree: 1,
      folder: "",
      incoming: 0,
      isFocused: true,
      labelVisible: true,
      outgoing: 1,
      tags: []
    });
    expect(state.nodes.find((node) => node.path === "B.md")).toMatchObject({ isSelected: true, ringVisible: false });
    expect(state.nodes.find((node) => node.path === "C.md")).toMatchObject({ isRelated: true });
    expect(state.nodes.find((node) => node.path === "D.md")).toMatchObject({ isDimmed: true });
    expect(state.nodes.find((node) => node.path === "D.md")?.fillAlpha).toBeGreaterThan(0.9);
    expect(state.nodes.find((node) => node.path === "D.md")?.fillColor).not.toBe(defaultGraphRenderPalette.node);
    expect(state.edges[0]?.alpha).toBeLessThanOrEqual(0.58);
    expect(state.edges[0]?.strokeWidth).toBeLessThan(1.3);
    expect(state.nodes.find((node) => node.path === "B.md")?.strokeWidth).toBe(0);
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

  it("大規模グラフでは選択だけで常時ラベルを出さずhover近傍だけを表示する", () => {
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
    expect(state.nodes.find((node) => node.path === "N2.md")?.radius).toBeCloseTo(5.05);
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
      showLabels: true
    });

    expect(hoveredState.nodes.find((node) => node.path === "N0.md")?.labelVisible).toBe(true);
    expect(hoveredState.nodes.find((node) => node.path === "N1.md")?.labelVisible).toBe(true);
    expect(hoveredState.nodes.find((node) => node.path === "N2.md")?.labelVisible).toBe(false);
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

    expect(normal.nodes[0]?.radius).toBeCloseTo(5.2);
    expect(zoomed.nodes[0]?.radius * 2.56).toBeCloseTo(8.32);
    expect(zoomed.nodes[0]?.strokeWidth).toBe(0);
  });

  it("CSS color文字列をPixi用numberへ変換する", () => {
    expect(parseGraphColor("#0ea5e9", 0)).toBe(0x0ea5e9);
    expect(parseGraphColor("#abc", 0)).toBe(0xaabbcc);
    expect(parseGraphColor("rgb(1, 2, 3)", 0)).toBe(0x010203);
    expect(parseGraphColor("not-a-color", 0x123456)).toBe(0x123456);
  });
});
