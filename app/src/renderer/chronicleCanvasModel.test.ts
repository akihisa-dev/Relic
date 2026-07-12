import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  buildChronicleCanvasYears,
  canvasToWorld,
  chronicleCanvasLabelAtPoint,
  chronicleCanvasTextOpacity,
  chronicleCanvasYearFontSize,
  chronicleCanvasYearHeaderHeight,
  chronicleCanvasYearLabelY,
  chronicleCanvasYearOpacity,
  compressedYearDistance,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera,
  stepChronicleCanvasScene,
  visibleChronicleCanvasYears,
  worldToCanvas,
  zoomChronicleCanvasAtPoint
} from "./chronicleCanvasModel";

function entry(fileName: string, path: string, startYear: number, endYear = startYear): ChartEntry {
  return {
    chronicleCalendarName: "",
    chronicleEntryIndex: 0,
    endLabel: String(endYear),
    endPoint: { month: null, year: endYear },
    endValue: endYear,
    fileName,
    path,
    startLabel: String(startYear),
    startPoint: { month: null, year: startYear },
    startValue: startYear
  };
}

describe("chronicleCanvasModel", () => {
  it("存在する年だけを過去から未来へ並べ、長い空白を圧縮する", () => {
    const years = buildChronicleCanvasYears([
      entry("A", "a.md", -100, 10),
      entry("B", "b.md", 11, 1000)
    ]);

    expect(years.map((year) => year.value)).toEqual([-100, 10, 11, 1000]);
    expect(years.map((year) => year.x)).toEqual([...years.map((year) => year.x)].sort((a, b) => a - b));
    expect(compressedYearDistance(1000)).toBeGreaterThan(compressedYearDistance(10));
    expect(compressedYearDistance(1000)).toBeLessThan(compressedYearDistance(10) * 10);
  });

  it("単年と期間を独立項目として収束済みの位置へ配置する", () => {
    const scene = createChronicleCanvasScene([
      entry("A", "a.md", 100),
      entry("B", "b.md", 100),
      entry("Range", "range.md", 100, 300)
    ], () => 0.5);

    expect(scene.items).toHaveLength(3);
    expect(scene.items[0].x).toBeCloseTo(scene.items[0].startX, 1);
    expect(scene.items[2].endX).toBeGreaterThan(scene.items[2].startX);
    expect(Math.abs(scene.items[0].y - scene.items[1].y)).toBeGreaterThan(10);
    expect(scene.items.every((item) => item.vx === 0 && item.vy === 0)).toBe(true);
  });

  it("一時移動した項目を対応年へ戻し、近傍項目にも反発を伝える", () => {
    const scene = createChronicleCanvasScene([
      entry("A", "a.md", 100),
      entry("B", "b.md", 100)
    ], () => 0.5);
    const dragged = scene.items[0];
    const neighbor = scene.items[1];
    const anchorX = dragged.startX;
    const homeY = dragged.homeY;
    dragged.x += 20;
    dragged.y = neighbor.y;
    const initialYDistance = Math.abs(dragged.y - homeY);

    stepChronicleCanvasScene(scene.items, dragged.id, 1 / 60);
    expect(neighbor.vy).not.toBe(0);
    for (let index = 0; index < 180; index += 1) stepChronicleCanvasScene(scene.items, null, 1 / 60);
    expect(Math.abs(dragged.x - anchorX)).toBeLessThan(1);
    expect(Math.abs(dragged.y - homeY)).toBeLessThan(initialYDistance);
    expect(Math.abs(dragged.y - homeY)).toBeLessThan(12);
  });

  it("カメラ変換とポインター中心ズームを往復できる", () => {
    const scene = createChronicleCanvasScene([entry("A", "a.md", 100)], () => 0.5);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);
    const focus = { x: 320, y: 220 };
    const worldBefore = canvasToWorld(focus, camera);

    zoomChronicleCanvasAtPoint(camera, camera.scale * 1.5, focus);

    expect(canvasToWorld(focus, camera)).toEqual(worldBefore);
    expect(worldToCanvas(worldBefore, camera).x).toBeCloseTo(focus.x);
    expect(worldToCanvas(worldBefore, camera).y).toBeCloseTo(focus.y);
  });

  it("年ラベルを縦パンに影響されないヘッダー領域へ置く", () => {
    const camera = { ...createChronicleCanvasCamera(), panY: -100 };

    expect(chronicleCanvasYearLabelY(camera.scale)).toBe(25);
    expect(chronicleCanvasYearHeaderHeight(camera.scale)).toBeGreaterThan(chronicleCanvasYearLabelY(camera.scale));
  });

  it("ズームに応じて文字を徐々に薄くし、年ラベルを間引く", () => {
    expect(chronicleCanvasTextOpacity(0.08)).toBe(0);
    expect(chronicleCanvasYearOpacity(0.08)).toBe(0.5);
    expect(chronicleCanvasTextOpacity(0.5)).toBeGreaterThan(0);
    expect(chronicleCanvasTextOpacity(1)).toBe(1);
    expect(chronicleCanvasYearFontSize(0.08)).toBe(9);
    expect(chronicleCanvasYearFontSize(0.82)).toBeCloseTo(11);
    expect(chronicleCanvasYearFontSize(2.4)).toBeGreaterThan(chronicleCanvasYearFontSize(0.82));
    const camera = { ...createChronicleCanvasCamera(), panX: 0, scale: 0.1 };
    const years = [
      { value: 1, x: 0 },
      { value: 2, x: 100 },
      { value: 3, x: 1000 }
    ];
    expect(visibleChronicleCanvasYears(years, camera).map((year) => year.value)).toEqual([1, 3]);
  });

  it("通常の濃さに達したファイル名だけをクリック対象にする", () => {
    const hits = [
      { height: 20, itemId: "faint", opacity: 0.3, width: 100, x: 0, y: 0 },
      { height: 20, itemId: "visible", opacity: 0.9, width: 100, x: 0, y: 30 }
    ];

    expect(chronicleCanvasLabelAtPoint(hits, { x: 10, y: 10 })).toBeNull();
    expect(chronicleCanvasLabelAtPoint(hits, { x: 10, y: 40 })?.itemId).toBe("visible");
  });
});
