import { describe, expect, it } from "vitest";

import {
  buildAutomaticDiagramPrintArea,
  buildDiagramPrintPreviewLayout,
  moveDiagramPrintAreaToGrid,
  resizeDiagramPrintAreaToGrid
} from "./diagramPrintPreview";

describe("buildDiagramPrintPreviewLayout", () => {
  it("実寸指定では用紙サイズと余白から複数ページ境界を計算する", () => {
    const layout = buildDiagramPrintPreviewLayout(
      { height: 1700, width: 1200, x: 32, y: 64 },
      { marginPreset: "normal", orientation: "portrait", paperSize: "A4", scale: 1, scaleMode: "actual" }
    );

    expect(layout.pages).toHaveLength(4);
    expect(layout.pages[0]).toMatchObject({
      contentX: 32,
      contentY: 64,
      label: "1"
    });
    expect(layout.pages[3]?.label).toBe("4");
    expect(layout.pages[0]?.paperX).toBeLessThan(layout.pages[0]?.contentX ?? 0);
    expect(layout.pages[0]?.paperY).toBeLessThan(layout.pages[0]?.contentY ?? 0);
  });

  it("用紙に収める指定では印刷領域全体を1ページとして扱う", () => {
    const layout = buildDiagramPrintPreviewLayout(
      { height: 1700, width: 1200, x: 32, y: 64 },
      { marginPreset: "small", orientation: "landscape", paperSize: "A3", scale: 1, scaleMode: "fit" }
    );

    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0]).toMatchObject({
      contentHeight: 1728,
      contentWidth: 1216,
      label: "1"
    });
  });

  it("幅に合わせる指定では横幅を1ページに収めて縦方向へ分割する", () => {
    const layout = buildDiagramPrintPreviewLayout(
      { height: 2600, width: 900, x: 0, y: 0 },
      { marginPreset: "none", orientation: "portrait", paperSize: "A4", scale: 1, scaleMode: "width" }
    );

    expect(layout.pages.length).toBeGreaterThan(1);
    expect(layout.pages.every((page) => page.contentWidth === 928)).toBe(true);
  });

  it("未設定の印刷領域はキャンバス全体ではなく実内容からグリッド単位で計算する", () => {
    const area = buildAutomaticDiagramPrintArea({
      lines: [{
        from: "a",
        id: "l1",
        label: "Line label",
        to: "b"
      }],
      nodes: [
        { height: 64, id: "a", layer: 1, shape: "process", text: "A", width: 160, x: 96, y: 96 },
        { height: 64, id: "b", layer: 1, shape: "process", text: "B", width: 160, x: 416, y: 96 }
      ],
      title: "Diagram",
      type: "diagram"
    }, { marginPreset: "normal", orientation: "portrait", paperSize: "A4", scale: 1, scaleMode: "actual" });

    expect(area.x % 32).toBe(0);
    expect(area.y % 32).toBe(0);
    expect(area.width % 32).toBe(0);
    expect(area.height % 32).toBe(0);
    expect(area.x).toBeLessThanOrEqual(64);
    expect(area.width).toBeLessThan(900);
  });

  it("空Diagramでは用紙設定から1ページ分のグリッド単位範囲を計算する", () => {
    const area = buildAutomaticDiagramPrintArea({
      lines: [],
      nodes: [],
      title: "Empty",
      type: "diagram"
    }, { marginPreset: "none", orientation: "landscape", paperSize: "A4", scale: 1, scaleMode: "actual" });

    expect(area).toMatchObject({ x: 0, y: 0 });
    expect(area.width % 32).toBe(0);
    expect(area.height % 32).toBe(0);
    expect(area.width).toBeGreaterThan(area.height);
  });

  it("印刷領域の移動と辺リサイズを32pxグリッドへスナップする", () => {
    const moved = moveDiagramPrintAreaToGrid({ height: 160, width: 320, x: 33, y: 65 }, 17, 31);
    expect(moved).toEqual({ height: 160, width: 320, x: 64, y: 96 });

    const resized = resizeDiagramPrintAreaToGrid({ height: 160, width: 320, x: 64, y: 96 }, "left", 47, 0);
    expect(resized).toEqual({ height: 160, width: 288, x: 96, y: 96 });
  });
});
