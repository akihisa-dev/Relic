import { describe, expect, it } from "vitest";

import type { ChartEntry } from "../shared/ipc";
import { buildChronicleBubbleLayout, hitTestChronicleBubble } from "./chronicleBubbleLayout";

describe("chronicleBubbleLayout", () => {
  it("期間が長いファイルバブルほど横幅を広くし、極端な期間でも上限に収める", () => {
    const layout = buildChronicleBubbleLayout([
      entry("short.md", 0, 100, 100),
      entry("middle.md", 0, 100, 150),
      entry("long.md", 0, 100, 10000)
    ], { maxBubbleWidth: 240, minBubbleWidth: 120 });

    const widths = layout.shapes.map((shape) => shape.width);
    expect(widths[0]).toBe(120);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBe(240);
  });

  it("同じcategoryのファイルバブルを近い行に配置する", () => {
    const layout = buildChronicleBubbleLayout([
      entry("a.md", 0, 10, 20, "政治"),
      entry("b.md", 1, 30, 40, "戦争"),
      entry("c.md", 2, 50, 60, "政治")
    ]);

    const [a, b, c] = layout.shapes;
    expect(Math.abs(a.y - c.y)).toBeLessThanOrEqual(Math.abs(a.y - b.y));
  });

  it("Canvas座標からクリック対象のファイルバブルを取得できる", () => {
    const layout = buildChronicleBubbleLayout([entry("target.md", 0, 1, 1)]);
    const target = layout.shapes[0];

    expect(hitTestChronicleBubble(layout.shapes, target.x + 4, target.y + 4)?.entry.path).toBe("target.md");
    expect(hitTestChronicleBubble(layout.shapes, target.x - 1, target.y - 1)).toBeNull();
  });
});

function entry(path: string, chronicleEntryIndex: number, startValue: number, endValue: number, category?: string): ChartEntry {
  return {
    category,
    chronicleCalendarName: "メイン暦",
    chronicleEntryIndex,
    endLabel: String(endValue),
    endPoint: { month: null, year: endValue },
    endValue,
    fileName: path.replace(/\.md$/, ""),
    path,
    startLabel: String(startValue),
    startPoint: { month: null, year: startValue },
    startValue
  };
}
