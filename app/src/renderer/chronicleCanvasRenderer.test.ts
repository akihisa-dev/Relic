import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import {
  chronicleCanvasYearLabelY,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera
} from "./chronicleCanvasModel";
import { drawChronicleCanvas } from "./chronicleCanvasRenderer";

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

  it("ホバー中の項目名を14pxでカーソル位置へ描画する", () => {
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

    expect(fillTextCalls.find((call) => call.text === "A")).toMatchObject({
      font: "750 14px -apple-system, BlinkMacSystemFont, sans-serif",
      text: "A",
      x: hoveredPoint.x,
      y: hoveredPoint.y - 20
    });
  });

  it("非表示カテゴリを描画せず、候補外カテゴリも安定した色で描画対象にする", () => {
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
    }, new Set(["category:戦争"]), new Map([["category:人物", 137]]));

    expect(fillTextCalls.some((call) => call.text === "War")).toBe(false);
    expect(fillTextCalls.some((call) => call.text === "People")).toBe(true);
    expect(fillStyleCalls).toContain("hsl(137 68% 40%)");
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
    }, new Set(), new Map(), {
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
    }, new Set(), new Map(), settings);

    expect(strokeRectCalls.length).toBeGreaterThan(0);
    expect(fillTextCalls.some((call) => call.text === "王国暦")).toBe(true);
    expect(fillTextCalls.some((call) => call.text === "Kingdom")).toBe(true);
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
    }, new Set(), new Map(), settings);

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
    }, new Set(), new Map(), settings);

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
