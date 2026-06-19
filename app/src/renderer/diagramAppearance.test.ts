import { describe, expect, it } from "vitest";

import type { RelicConnectedDiagramNode } from "../shared/diagramMarkdown";
import { diagramNodeTextColor } from "./diagramAppearance";

const nodeBase = {
  height: 64,
  id: "node-1",
  layer: 1,
  text: "確認",
  width: 160,
  x: 0,
  y: 0
} satisfies Omit<RelicConnectedDiagramNode, "shape" | "color">;

describe("diagramAppearance", () => {
  it("図形の塗り色は図形の色自体ではなく中立色のコントラストで文字色を返す", () => {
    const node = { ...nodeBase, shape: "process", color: "blue" } as RelicConnectedDiagramNode;
    expect(diagramNodeTextColor(node)).toBe("#1f1d19");
    expect(diagramNodeTextColor(node)).not.toBe("#102a4c");
  });

  it("色指定がない図形は図形テキスト色を保存しない", () => {
    const node = { ...nodeBase, shape: "process" } as RelicConnectedDiagramNode;
    expect(diagramNodeTextColor(node)).toBeNull();
  });

  it("領域図形でも塗り色に応じた中立色の文字色を返す", () => {
    const node = { ...nodeBase, shape: "area", color: "green" } as RelicConnectedDiagramNode;
    expect(diagramNodeTextColor(node)).toBe("#1f1d19");
    expect(diagramNodeTextColor(node)).not.toBeNull();
  });
});
