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
    const fillTextCalls: Array<{ font: string; text: string; x: number; y: number }> = [];
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
    const fillTextCalls: Array<{ font: string; text: string; x: number; y: number }> = [];
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

    expect(fillTextCalls.find((call) => call.text === "A")).toEqual({
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
    const fillTextCalls: Array<{ font: string; text: string; x: number; y: number }> = [];
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
});

function createCanvasContext(
  fillTextCalls: Array<{ font: string; text: string; x: number; y: number }>,
  fillStyleCalls: string[] = []
): CanvasRenderingContext2D {
  const context = {
    arc: () => undefined,
    beginPath: () => undefined,
    clearRect: () => undefined,
    fill: () => fillStyleCalls.push(String(context.fillStyle)),
    fillRect: () => undefined,
    fillText: (text: string, x: number, y: number) => {
      fillTextCalls.push({ font: context.font, text, x, y });
    },
    lineTo: () => undefined,
    measureText: () => ({ width: 42 }) as TextMetrics,
    moveTo: () => undefined,
    restore: () => undefined,
    save: () => undefined,
    stroke: () => undefined,
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
