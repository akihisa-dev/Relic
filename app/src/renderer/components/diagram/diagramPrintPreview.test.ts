import { describe, expect, it } from "vitest";

import { buildDiagramPrintPreviewLayout } from "./diagramPrintPreview";

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
      contentHeight: 1700,
      contentWidth: 1200,
      label: "1"
    });
  });

  it("幅に合わせる指定では横幅を1ページに収めて縦方向へ分割する", () => {
    const layout = buildDiagramPrintPreviewLayout(
      { height: 2600, width: 900, x: 0, y: 0 },
      { marginPreset: "none", orientation: "portrait", paperSize: "A4", scale: 1, scaleMode: "width" }
    );

    expect(layout.pages.length).toBeGreaterThan(1);
    expect(layout.pages.every((page) => page.contentWidth === 900)).toBe(true);
  });
});
