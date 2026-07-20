import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  CHRONICLE_CALENDAR_SURFACE_HEADER_INSET,
  CHRONICLE_CANVAS_ITEM_LABEL_OFFSET,
  CHRONICLE_CANVAS_LABEL_HEIGHT,
  canvasToWorld,
  changeChronicleCanvasPeriodScale,
  chronicleCanvasClickPath,
  chronicleCanvasLabelAtPoint,
  chronicleCanvasPointerItemAtPoint,
  chronicleCanvasPointerMovedBeyondClickThreshold,
  chronicleCanvasTextOpacity,
  chronicleCanvasVerticalScale,
  chronicleCanvasXToYear,
  chronicleCanvasYearToX,
  chronicleCanvasYearFontSize,
  chronicleCanvasYearHeaderHeight,
  chronicleCanvasYearLabelY,
  chronicleCanvasYearOpacity,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera,
  prepareChronicleCanvasPointerCancel,
  stepChronicleCanvasScene,
  visibleChronicleCanvasYearLabels,
  visibleChronicleCanvasYears,
  worldToCanvas,
  zoomChronicleCanvasAtPoint
} from "./chronicleCanvasModel";

function entry(fileName: string, path: string, startYear: number, endYear = startYear, calendarName?: string): ChartEntry {
  return {
    ...(calendarName ? { calendarName } : {}),
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
  it("データの有無に関係なく選択した期間スケールで年軸を生成する", () => {
    const camera = { ...createChronicleCanvasCamera(), panX: 0, scale: 1 };
    const years = visibleChronicleCanvasYears(10, camera, 400);

    expect(years.map((year) => year.value)).toEqual([-10, 1, 10, 20, 30, 40, 50]);
    expect(years.map((year) => year.x)).toEqual([-96, 0, 96, 192, 288, 384, 480]);
  });

  it("期間スケールだけで年の横位置を変え、データ構成には影響されない", () => {
    const compact = createChronicleCanvasScene([entry("A", "a.md", 100)], () => 0.5, 100);
    const detailed = createChronicleCanvasScene([
      entry("A", "a.md", 100),
      entry("B", "b.md", 10_000)
    ], () => 0.5, 10);

    expect(compact.items[0].startX).toBe(96);
    expect(detailed.items[0].startX).toBe(960);
    expect(detailed.items[0].startX).toBe(chronicleCanvasYearToX(100, 10));
    expect(chronicleCanvasXToYear(detailed.items[0].startX, 10)).toBe(100);
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
    expect(scene.items[2].rangeLabel).toBe("100 〜 300");
    expect(Math.abs(scene.items[0].y - scene.items[1].y)).toBeGreaterThan(10);
    expect(scene.items.every((item) => item.vx === 0 && item.vy === 0)).toBe(true);
  });

  it("基準暦項目と設定順の追加暦面へ項目を所属させる", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [
        { name: "王国暦", range: { end: 20, start: 1 }, yearOne: 100 },
        { name: "交易暦", range: null, yearOne: 200 }
      ],
      visibleCalendarNames: ["基準暦", "王国暦", "交易暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("Base", "base.md", 105),
      entry("Kingdom", "kingdom.md", 110, 110, "王国暦"),
      entry("Trade", "trade.md", 205, 205, "交易暦")
    ], () => 0.5, 10, settings);

    expect(scene.surfaces.map((surface) => surface.calendarName)).toEqual(["王国暦", "交易暦"]);
    expect(scene.surfaces[0]).toMatchObject({ rangeState: "bounded" });
    expect(scene.surfaces[1]).toMatchObject({ rangeState: "unset", startX: null, endX: null });
    expect(scene.items.map((item) => item.calendarName)).toEqual(["基準暦", "王国暦", "交易暦"]);
    expect(scene.items[1].y).toBeGreaterThan(scene.items[0].y);
    expect(scene.items[2].y).toBeGreaterThan(scene.items[1].y);
  });

  it("追加暦面の年ラベル帯より下へファイル項目を配置する", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 40, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("First", "first.md", 100, 140, "王国暦"),
      entry("Second", "second.md", 110, 110, "王国暦")
    ], () => 0.5, 10, settings);
    const surface = scene.surfaces[0];
    const surfaceTop = surface.y - surface.height / 2;
    const surfaceItems = scene.items.filter((item) => item.calendarName === "王国暦");
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);
    const surfaceTopOnCanvas = worldToCanvas({ x: 0, y: surfaceTop }, camera).y;
    const firstItemOnCanvas = worldToCanvas({ x: 0, y: Math.min(...surfaceItems.map((item) => item.y)) }, camera).y;

    expect(surfaceItems.every((item) => (
      item.minY >= surfaceTop + CHRONICLE_CALENDAR_SURFACE_HEADER_INSET - 8
    ))).toBe(true);
    expect(Math.min(...surfaceItems.map((item) => item.y))).toBeGreaterThan(
      surfaceTop + CHRONICLE_CALENDAR_SURFACE_HEADER_INSET - 12
    );
    expect(firstItemOnCanvas - CHRONICLE_CANVAS_ITEM_LABEL_OFFSET).toBeGreaterThan(
      surfaceTopOnCanvas + 18 + CHRONICLE_CANVAS_LABEL_HEIGHT / 2
    );
  });

  it("通常の縮小時にも暦面の見出し、項目、下端を重ねない高さを確保する", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 80, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("First", "first.md", 100, 120, "王国暦"),
      entry("Second", "second.md", 130, 140, "王国暦"),
      entry("Third", "third.md", 150, 160, "王国暦"),
      entry("Fourth", "fourth.md", 170, 180, "王国暦")
    ], () => 0.5, 10, settings);
    const surface = scene.surfaces[0];
    const items = scene.items
      .filter((item) => item.calendarName === "王国暦")
      .toSorted((left, right) => left.y - right.y);
    const scale = 0.5;
    const surfaceTop = surface.y - surface.height / 2;
    const surfaceBottom = surface.y + surface.height / 2;
    const firstLabelTop = (items[0].y - surfaceTop) * scale - CHRONICLE_CANVAS_ITEM_LABEL_OFFSET - CHRONICLE_CANVAS_LABEL_HEIGHT / 2;
    const lastRangeBottom = (items.at(-1)!.y - surfaceTop) * scale + 24 + CHRONICLE_CANVAS_LABEL_HEIGHT / 2;
    const itemScreenGaps = items.slice(1).map((item, index) => (item.y - items[index].y) * scale);

    expect(firstLabelTop).toBeGreaterThan(30);
    expect(itemScreenGaps.every((gap) => gap >= 60)).toBe(true);
    expect(lastRangeBottom).toBeLessThan((surfaceBottom - surfaceTop) * scale - 12);
  });

  it("最小倍率でも横軸だけを縮め、暦面の縦方向は安全間隔を保つ", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 80, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("First", "first.md", 100, 120, "王国暦"),
      entry("Second", "second.md", 130, 140, "王国暦"),
      entry("Third", "third.md", 150, 160, "王国暦")
    ], () => 0.5, 10, settings);
    const surface = scene.surfaces[0];
    const items = scene.items
      .filter((item) => item.calendarName === "王国暦")
      .toSorted((left, right) => left.y - right.y);
    const camera = { ...createChronicleCanvasCamera(), panX: 0, panY: 0, scale: 0.08 };
    const surfaceTop = surface.y - surface.height / 2;
    const surfaceTopOnCanvas = worldToCanvas({ x: 0, y: surfaceTop }, camera).y;
    const firstItemOnCanvas = worldToCanvas({ x: items[0].x, y: items[0].y }, camera);
    const secondItemOnCanvas = worldToCanvas({ x: items[1].x, y: items[1].y }, camera);

    expect(chronicleCanvasVerticalScale(camera.scale)).toBe(0.4);
    expect(firstItemOnCanvas.x).toBe(items[0].x * camera.scale);
    expect(firstItemOnCanvas.y - CHRONICLE_CANVAS_ITEM_LABEL_OFFSET).toBeGreaterThan(
      surfaceTopOnCanvas + 18 + CHRONICLE_CANVAS_LABEL_HEIGHT / 2
    );
    expect(secondItemOnCanvas.y - firstItemOnCanvas.y).toBeGreaterThanOrEqual(50);
  });

  it("宣言範囲外の項目を消さず警告状態へ含める", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 5, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("Overflow", "overflow.md", 110, 110, "王国暦")
    ], () => 0.5, 10, settings);

    expect(scene.items).toHaveLength(1);
    expect(scene.surfaces[0].rangeState).toBe("overflow");
    expect(scene.surfaces[0].contentEndX).toBeGreaterThan(scene.surfaces[0].endX ?? 0);
  });

  it("別の暦面に属する項目は互いに反発せず、縦ドラッグを所属領域内へ制限する", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [
        { name: "王国暦", range: { end: 20, start: 1 }, yearOne: 100 },
        { name: "交易暦", range: { end: 20, start: 1 }, yearOne: 100 }
      ],
      visibleCalendarNames: ["基準暦", "王国暦", "交易暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("Kingdom", "kingdom.md", 110, 110, "王国暦"),
      entry("Trade", "trade.md", 110, 110, "交易暦")
    ], () => 0.5, 10, settings);
    const [first, second] = scene.items;
    first.y = second.y;
    first.homeY = second.y;
    second.homeY = second.y;
    stepChronicleCanvasScene(scene.items, first.id, 1 / 60);
    expect(second.vy).toBe(0);
    first.y = first.maxY + 100;
    stepChronicleCanvasScene(scene.items, first.id, 1 / 60);
    expect(first.y).toBe(first.maxY);
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

  it("期間スケール変更では画面中央の年とズーム率を維持する", () => {
    const camera = { ...createChronicleCanvasCamera(), panX: -800, scale: 1.2 };
    const viewportWidth = 800;
    const centerWorldBefore = (viewportWidth / 2 - camera.panX) / camera.scale;
    const centerYearBefore = chronicleCanvasXToYear(centerWorldBefore, 10);

    changeChronicleCanvasPeriodScale(camera, 10, 100, viewportWidth);

    const centerWorldAfter = (viewportWidth / 2 - camera.panX) / camera.scale;
    expect(chronicleCanvasXToYear(centerWorldAfter, 100)).toBeCloseTo(centerYearBefore);
    expect(camera.scale).toBe(1.2);
  });

  it("年ラベルを縦パンに影響されないヘッダー領域へ置く", () => {
    const camera = { ...createChronicleCanvasCamera(), panY: -100 };

    expect(chronicleCanvasYearLabelY(camera.scale)).toBe(25);
    expect(chronicleCanvasYearHeaderHeight(camera.scale)).toBeGreaterThan(chronicleCanvasYearLabelY(camera.scale));
  });

  it("ズームに応じて文字を徐々に薄くし、年ラベルを間引く", () => {
    expect(chronicleCanvasTextOpacity(0.08)).toBe(0);
    expect(chronicleCanvasTextOpacity(0.1)).toBeGreaterThan(0);
    expect(chronicleCanvasTextOpacity(0.34)).toBeGreaterThan(0);
    expect(chronicleCanvasYearOpacity(0.08)).toBe(0.5);
    expect(chronicleCanvasTextOpacity(0.5)).toBeGreaterThan(0);
    expect(chronicleCanvasTextOpacity(1)).toBe(1);
    expect(chronicleCanvasYearFontSize(0.08)).toBe(9);
    expect(chronicleCanvasYearFontSize(0.82)).toBeCloseTo(11);
    expect(chronicleCanvasYearFontSize(2.4)).toBeGreaterThan(chronicleCanvasYearFontSize(0.82));
    const camera = { ...createChronicleCanvasCamera(), panX: 0, scale: 0.1 };
    const years = visibleChronicleCanvasYears(10, camera, 800);
    const labels = visibleChronicleCanvasYearLabels(years, camera);
    expect(years.some((year) => year.value === 0)).toBe(false);
    expect(labels.length).toBeLessThan(years.length);
    expect(labels.every((year) => year.value === 1 || year.value % 100 === 0)).toBe(true);
  });

  it("どの年代へ移動しても表示範囲に必要な年目盛りだけを生成する", () => {
    const camera = createChronicleCanvasCamera();
    camera.scale = 0.08;
    camera.panX = -500_000;

    const visible = visibleChronicleCanvasYears(1, camera, 800);

    expect(visible.length).toBeLessThan(130);
    expect(visible.at(0)?.value).toBeGreaterThan(65_000);
    expect(visible.at(-1)?.value).toBeLessThan(65_300);
    expect((visible.at(-1)?.value ?? 0) - (visible.at(0)?.value ?? 0)).toBe(visible.length - 1);
  });

  it("通常の濃さに達したファイル名だけをクリック対象にする", () => {
    const hits = [
      { height: 20, itemId: "faint", opacity: 0.3, width: 100, x: 0, y: 0 },
      { height: 20, itemId: "visible", opacity: 0.9, width: 100, x: 0, y: 30 }
    ];

    expect(chronicleCanvasLabelAtPoint(hits, { x: 10, y: 10 })).toBeNull();
    expect(chronicleCanvasLabelAtPoint(hits, { x: 10, y: 40 })?.itemId).toBe("visible");
  });

  it("ノード・期間線・ラベル領域を同じ年表項目としてクリック対象にする", () => {
    const scene = createChronicleCanvasScene([entry("Range", "range.md", 100, 300)], () => 0.5);
    const item = scene.items[0];
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);
    const displacementX = item.x - (item.startX + item.endX) / 2;
    const start = worldToCanvas({ x: item.startX + displacementX, y: item.y }, camera);
    const middle = worldToCanvas({ x: item.x, y: item.y }, camera);
    const label = { x: middle.x, y: middle.y - 22 };

    expect(chronicleCanvasPointerItemAtPoint(scene.items, camera, start)).toBe(item);
    expect(chronicleCanvasPointerItemAtPoint(scene.items, camera, middle)).toBe(item);
    expect(chronicleCanvasPointerItemAtPoint(scene.items, camera, label)).toBe(item);
    expect(chronicleCanvasClickPath(item, false)).toBe("range.md");
  });

  it("ドラッグと年表ヘッダーはファイルを開く対象にしない", () => {
    const scene = createChronicleCanvasScene([entry("Range", "range.md", 100, 300)], () => 0.5);
    const item = scene.items[0];
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);

    expect(chronicleCanvasClickPath(item, true)).toBeNull();
    expect(chronicleCanvasPointerItemAtPoint(scene.items, camera, { x: 400, y: 10 })).toBeNull();
    expect(chronicleCanvasClickPath(null, false)).toBeNull();
    expect(chronicleCanvasPointerMovedBeyondClickThreshold({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(false);
    expect(chronicleCanvasPointerMovedBeyondClickThreshold({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });

  it("ドラッグ中断時だけ項目を本来の配置へ戻す計算を再開する", () => {
    const scene = createChronicleCanvasScene([entry("Moved", "moved.md", 100)], () => 0.5);
    const item = scene.items[0];
    const anchorX = item.startX;
    item.x += 80;
    item.y += 40;
    item.vx = 12;
    item.vy = 8;
    const camera = { ...createChronicleCanvasCamera(), velocityX: 6, velocityY: 4 };
    const distanceBefore = Math.hypot(item.x - anchorX, item.y - item.homeY);

    expect(prepareChronicleCanvasPointerCancel(camera, item, true)).toBe(true);
    expect(camera).toMatchObject({ velocityX: 0, velocityY: 0 });
    expect(item).toMatchObject({ vx: 0, vy: 0 });
    stepChronicleCanvasScene(scene.items, null, 1 / 60);

    expect(Math.hypot(item.x - anchorX, item.y - item.homeY)).toBeLessThan(distanceBefore);
    expect(prepareChronicleCanvasPointerCancel(camera, item, false)).toBe(false);
    camera.velocityX = 5;
    camera.velocityY = 3;
    expect(prepareChronicleCanvasPointerCancel(camera, null, true)).toBe(false);
    expect(camera).toMatchObject({ velocityX: 0, velocityY: 0 });
  });
});
