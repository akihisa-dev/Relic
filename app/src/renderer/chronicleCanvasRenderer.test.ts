import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  CHRONICLE_CANVAS_MIN_VERTICAL_SCALE,
  chronicleCanvasYearLabelY,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera,
  worldToCanvas
} from "./chronicleCanvasModel";
import { drawChronicleCanvas } from "./chronicleCanvasRenderer";
import { chronicleCalendarCategoryVisibilityKey } from "./chronicleCalendarTreeModel";

function entry(fileName: string, path: string, year: number, category?: string): ChartEntry {
  return {
    ...(category ? { category } : {}),
    chronicleEntryIndex: 0,
    endLabel: String(year),
    endPoint: { month: null, year },
    endValue: year,
    fileName,
    path,
    startLabel: String(year),
    startPoint: { month: null, year },
    startValue: year
  };
}

describe("chronicleCanvasRenderer", () => {
  it("項目の年ではなく期間スケールの規則に沿った年ラベルを描画する", () => {
    const scene = createChronicleCanvasScene([entry("A", "a.md", 105)], () => 0.5, 10);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 400);
    const fillTextCalls: FillTextCall[] = [];
    const context = createCanvasContext(fillTextCalls);

    drawChronicleCanvas(context, scene, camera, null, null, 800, 400, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    });

    const yearLabels = fillTextCalls.filter((call) => call.y === chronicleCanvasYearLabelY(camera.scale));
    expect(yearLabels.map((call) => call.text)).toEqual(expect.arrayContaining(["100", "110"]));
    expect(yearLabels.map((call) => call.text)).not.toContain("105");
  });

  it("項目名、年の順で節点の上へ1行に描画する", () => {
    const scene = createChronicleCanvasScene([entry("A", "a.md", 100)], () => 0.5);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 400);
    const fillTextCalls: FillTextCall[] = [];
    const context = createCanvasContext(fillTextCalls);

    drawChronicleCanvas(context, scene, camera, null, null, 800, 400, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    });

    const itemY = worldToCanvas({ x: scene.items[0].x, y: scene.items[0].y }, camera).y;
    const nameLabel = fillTextCalls.find((call) => call.text === "A")!;
    const rangeLabel = fillTextCalls.find((call) => call.text === "100" && call.font.startsWith("650 11px"))!;
    expect(nameLabel.x).toBeLessThan(rangeLabel.x);
    expect(nameLabel.y).toBe(rangeLabel.y);
    expect(rangeLabel.y).toBeLessThan(itemY);
  });

  it("ホバー中も項目名、年の順でポインターの上側へ1行に描画する", () => {
    const scene = createChronicleCanvasScene([entry("A", "a.md", 100)], () => 0.5);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 400);
    const fillTextCalls: FillTextCall[] = [];
    const context = createCanvasContext(fillTextCalls);
    const hoveredPoint = { x: 250, y: 200 };

    drawChronicleCanvas(
      context,
      scene,
      camera,
      scene.items[0].id,
      hoveredPoint,
      800,
      400,
      {
        background: "#fff",
        categoryLightness: 40,
        categorySaturation: 68,
        mutedText: "#666",
        text: "#111"
      }
    );

    const hoveredName = fillTextCalls.find((call) => call.text === "A")!;
    const hoveredRange = fillTextCalls.find((call) => call.text === "100" && call.font.startsWith("650 11px"))!;
    expect(hoveredName).toMatchObject({
      font: "750 14px -apple-system, BlinkMacSystemFont, sans-serif",
      text: "A",
      y: hoveredPoint.y - 24
    });
    expect(hoveredRange.y).toBe(hoveredName.y);
    expect(hoveredName.x).toBeLessThan(hoveredPoint.x);
    expect(hoveredRange.x).toBeGreaterThan(hoveredPoint.x);
  });

  it("カテゴリごとの安定した色で項目を描画する", () => {
    const scene = createChronicleCanvasScene([
      entry("War", "war.md", 100, "戦争"),
      entry("People", "people.md", 110, "人物")
    ], () => 0.5);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 400);
    const fillTextCalls: FillTextCall[] = [];
    const fillStyleCalls: string[] = [];
    const context = createCanvasContext(fillTextCalls, fillStyleCalls);

    drawChronicleCanvas(context, scene, camera, scene.items[1].id, { x: 400, y: 200 }, 800, 400, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    }, new Map([["category:戦争", 20], ["category:人物", 137]]));

    expect(fillTextCalls.some((call) => call.text === "War")).toBe(true);
    expect(fillTextCalls.some((call) => call.text === "People")).toBe(true);
    expect(fillStyleCalls).toContain("hsl(137 68% 40%)");
  });

  it("同じカテゴリでも指定した暦に属する項目だけを非表示にする", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 20, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([
      entry("Base", "base.md", 105, "戦役"),
      { ...entry("Kingdom", "kingdom.md", 10, "戦役"), calendarName: "王国暦" }
    ], () => 0.5, 10, settings);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);
    const fillTextCalls: FillTextCall[] = [];

    drawChronicleCanvas(
      createCanvasContext(fillTextCalls),
      scene,
      camera,
      null,
      null,
      800,
      500,
      { background: "#fff", categoryLightness: 40, categorySaturation: 68, mutedText: "#666", text: "#111" },
      new Map(),
      settings,
      new Map(),
      new Set([chronicleCalendarCategoryVisibilityKey("王国暦", "category:戦役")])
    );

    expect(fillTextCalls.some((call) => call.text === "Base")).toBe(true);
    expect(fillTextCalls.some((call) => call.text === "Kingdom")).toBe(false);
  });

  it("先頭行の基準暦名を背景と異なる文字色で描画する", () => {
    const scene = createChronicleCanvasScene([entry("A", "a.md", 560)], () => 0.5, 10);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 400);
    const fillTextCalls: FillTextCall[] = [];
    const context = createCanvasContext(fillTextCalls);

    drawChronicleCanvas(context, scene, camera, null, null, 800, 400, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    }, new Map(), {
      baseCalendarName: "基準暦",
      calendars: [{ name: "比較暦", range: { end: 100, start: 1 }, yearOne: 10 }],
      visibleCalendarNames: ["基準暦", "比較暦"]
    });

    expect(fillTextCalls.find((call) => call.text === "基準暦")).toMatchObject({
      fillStyle: "#666",
      x: 10,
      y: chronicleCanvasYearLabelY(camera.scale, 0)
    });
  });

  it("追加暦を半透明の暦面と局所年目盛りとして描画する", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 20, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const addedEntry = { ...entry("Kingdom", "kingdom.md", 110), calendarName: "王国暦" };
    const scene = createChronicleCanvasScene([addedEntry], () => 0.5, 10, settings);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);
    const fillTextCalls: FillTextCall[] = [];
    const strokeRectCalls: Array<{ height: number; width: number; x: number; y: number }> = [];
    const context = createCanvasContext(fillTextCalls, [], strokeRectCalls);

    drawChronicleCanvas(context, scene, camera, null, null, 800, 500, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    }, new Map(), settings, new Map([["王国暦", 210]]));

    expect(strokeRectCalls.length).toBeGreaterThan(0);
    expect(fillTextCalls.find((call) => call.text === "王国暦")).toMatchObject({
      fillStyle: "hsl(210 68% 40%)"
    });
    expect(fillTextCalls.some((call) => call.text === "Kingdom")).toBe(true);
  });

  it("最小倍率でも暦面の高さを安全な縦倍率で描画する", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 40, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([
      { ...entry("First", "first.md", 110), calendarName: "王国暦" },
      { ...entry("Second", "second.md", 120), calendarName: "王国暦" }
    ], () => 0.5, 10, settings);
    const camera = { ...createChronicleCanvasCamera(), panX: 0, panY: 0, scale: 0.08 };
    const strokeRectCalls: Array<{ height: number; width: number; x: number; y: number }> = [];

    drawChronicleCanvas(createCanvasContext([], [], strokeRectCalls), scene, camera, null, null, 800, 500, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    }, new Map(), settings);

    expect(strokeRectCalls[0].height).toBeCloseTo(
      scene.surfaces[0].height * CHRONICLE_CANVAS_MIN_VERTICAL_SCALE
    );
  });

  it("追加暦の年ラベルを基準暦と同じ画面間隔で間引く", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 100, start: 1 }, yearOne: 1 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const scene = createChronicleCanvasScene([], () => 0.5, 1, settings);
    const camera = { ...createChronicleCanvasCamera(), panX: 0, panY: 0, scale: 0.5 };
    const fillTextCalls: FillTextCall[] = [];
    const context = createCanvasContext(fillTextCalls);

    drawChronicleCanvas(context, scene, camera, null, null, 800, 500, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    }, new Map(), settings);

    const baseLabelY = chronicleCanvasYearLabelY(camera.scale);
    const baseLabelXs = new Set(fillTextCalls.filter((call) => (
      call.y === baseLabelY && /^-?\d+$/.test(call.text)
    )).map((call) => call.x));
    const addedLabelXs = fillTextCalls.filter((call) => (
      call.y !== baseLabelY && /^-?\d+$/.test(call.text)
    )).map((call) => call.x);

    expect(addedLabelXs.length).toBeGreaterThan(1);
    expect(addedLabelXs.every((x) => baseLabelXs.has(x))).toBe(true);
  });

  it("設定範囲外の項目を警告色の破線延長領域へ描画する", () => {
    const settings = {
      baseCalendarName: "基準暦",
      calendars: [{ name: "王国暦", range: { end: 5, start: 1 }, yearOne: 100 }],
      visibleCalendarNames: ["基準暦", "王国暦"]
    };
    const addedEntry = { ...entry("Outside", "outside.md", 115), calendarName: "王国暦" };
    const scene = createChronicleCanvasScene([addedEntry], () => 0.5, 10, settings);
    const camera = createChronicleCanvasCamera();
    initializeChronicleCanvasCamera(camera, scene, 800, 500);
    const lineDashCalls: number[][] = [];
    const context = createCanvasContext([], [], [], lineDashCalls);

    drawChronicleCanvas(context, scene, camera, null, null, 800, 500, {
      background: "#fff",
      categoryLightness: 40,
      categorySaturation: 68,
      mutedText: "#666",
      text: "#111"
    }, new Map(), settings);

    expect(lineDashCalls).toContainEqual([6, 5]);
  });
});

interface FillTextCall {
  fillStyle: string;
  font: string;
  text: string;
  x: number;
  y: number;
}

function createCanvasContext(
  fillTextCalls: FillTextCall[],
  fillStyleCalls: string[] = [],
  strokeRectCalls: Array<{ height: number; width: number; x: number; y: number }> = [],
  lineDashCalls: number[][] = []
): CanvasRenderingContext2D {
  const context = {
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    fill: () => fillStyleCalls.push(String(context.fillStyle)),
    fillRect: () => undefined,
    fillText: (text: string, x: number, y: number) => {
      fillTextCalls.push({ fillStyle: String(context.fillStyle), font: context.font, text, x, y });
    },
    lineTo: () => undefined,
    measureText: () => ({ width: 42 }) as TextMetrics,
    moveTo: () => undefined,
    restore: () => undefined,
    save: () => undefined,
    setLineDash: (segments: number[]) => lineDashCalls.push(segments),
    stroke: () => undefined,
    strokeRect: (x: number, y: number, width: number, height: number) => strokeRectCalls.push({ height, width, x, y }),
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    lineCap: "round" as CanvasLineCap,
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "center" as CanvasTextAlign,
    textBaseline: "middle" as CanvasTextBaseline
  } as unknown as CanvasRenderingContext2D;
  return context;
}
