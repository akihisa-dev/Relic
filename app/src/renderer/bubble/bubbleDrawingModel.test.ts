import { describe, expect, it } from "vitest";

import type { WorkspaceGraphNode } from "../../shared/ipc";
import {
  bubbleCategoryAtWorldPoint,
  bubbleCategoryBubbles,
  bubbleColorWithAlpha,
  bubbleMembranePalette,
  bubbleNodeBubbleHighlight,
  bubbleNodeHighlightColor
} from "./bubbleDrawingModel";
import {
  defaultGraphDrawTheme,
  graphCategoryColor,
  graphCategoryColors,
  graphNodeColor
} from "../graph/graphThemeModel";
import type { BubbleSimNode } from "./bubbleTypes";

function graphNode(type: WorkspaceGraphNode["type"]): WorkspaceGraphNode {
  return {
    backlinkCount: 0,
    exists: type !== "unresolved",
    id: `${type}.md`,
    label: type,
    linkCount: 0,
    path: `${type}.md`,
    type
  };
}

describe("bubbleDrawingModel", () => {
  it("描画時はキャッシュ済みテーマだけを使う", () => {
    const theme = {
      ...defaultGraphDrawTheme,
      accent: "#111111",
      textMuted: "#222222",
      textSecondary: "#333333"
    };
    expect(graphNodeColor(graphNode("tag"), theme)).toBe("#111111");
    expect(graphNodeColor(graphNode("attachment"), theme)).toBe("#222222");
    expect(graphNodeColor(graphNode("unresolved"), theme)).toBe("#222222");
    expect(graphNodeColor(graphNode("file"), theme)).toBe("#333333");
  });

  it("カテゴリを持つファイルだけを所属バブルへ含める", () => {
    const createNode = (
      id: string,
      x: number,
      y: number,
      category?: string
    ): BubbleSimNode => ({
      ...graphNode("file"),
      ...(category ? { category } : {}),
      fx: null,
      fy: null,
      id,
      label: id,
      path: id,
      vx: 0,
      vy: 0,
      x,
      y
    });
    const bubbles = bubbleCategoryBubbles([
      createNode("A.md", 10, 20, "人物"),
      createNode("B.md", 50, 20, "人物"),
      createNode("C.md", -80, 0),
      createNode("D.md", 0, 0, "資料")
    ]);

    expect(bubbles).toHaveLength(2);
    expect(bubbles.map((bubble) => bubble.category)).toEqual(["資料", "人物"]);
    expect(bubbles.every((bubble) => bubble.points.length === 72)).toBe(true);
    expect(bubbles.some((bubble) => bubble.points.some((point) =>
      Math.hypot(point.x - bubble.x, point.y - bubble.y) < bubble.radius - 1
    ))).toBe(true);
  });

  it("カテゴリ名とテーマから安定した色を割り当てる", () => {
    const darkTheme = { ...defaultGraphDrawTheme, background: "#11120f" };
    const personColor = graphCategoryColor("人物", defaultGraphDrawTheme);

    expect(graphCategoryColor("人物", defaultGraphDrawTheme)).toBe(personColor);
    expect(graphCategoryColor("資料", defaultGraphDrawTheme)).not.toBe(personColor);
    expect(graphCategoryColor("人物", darkTheme)).not.toBe(personColor);
    expect(graphNodeColor({ ...graphNode("file"), category: "人物" }, defaultGraphDrawTheme))
      .toBe(personColor);
    expect(graphNodeColor(graphNode("file"), defaultGraphDrawTheme))
      .toBe(defaultGraphDrawTheme.textSecondary);
    expect(bubbleNodeBubbleHighlight(defaultGraphDrawTheme))
      .toBe(defaultGraphDrawTheme.background);
    expect(bubbleNodeBubbleHighlight(darkTheme)).toBe(darkTheme.text);
  });

  it("表示中のカテゴリ色を入力順に関係なく色相環へ分散する", () => {
    const categories = ["人物", "勢力", "戦役", "地誌", "資料", "案内"];
    const forward = graphCategoryColors(categories, defaultGraphDrawTheme);
    const reversed = graphCategoryColors([...categories].reverse(), defaultGraphDrawTheme);
    const dark = graphCategoryColors(
      categories,
      { ...defaultGraphDrawTheme, background: "#11120f" }
    );
    const hues = [...forward.values()].map((color) =>
      Number(color.match(/^hsl\((\d+)/)?.[1])
    ).sort((left, right) => left - right);
    const gaps = hues.map((hue, index) => {
      const next = hues[(index + 1) % hues.length]!;
      return (next - hue + 360) % 360;
    });

    expect([...forward]).toEqual([...reversed]);
    expect(new Set(forward.values())).toHaveLength(categories.length);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(59);
    expect([...dark.keys()]).toEqual([...forward.keys()]);
    expect([...dark.values()].every((color) => color.endsWith("68%)"))).toBe(true);
    expect(graphNodeColor(
      { ...graphNode("file"), category: "人物" },
      defaultGraphDrawTheme,
      forward
    )).toBe(forward.get("人物"));
  });

  it("ホバー時の強調色に固定のアクセント色を使わない", () => {
    const categoryColors = new Map([["人物", "hsl(195 62% 40%)"]]);
    const categorizedNode = { ...graphNode("file"), category: "人物" };

    expect(bubbleNodeHighlightColor(
      categorizedNode,
      defaultGraphDrawTheme,
      categoryColors
    )).toBe("hsl(195 62% 40%)");
    expect(bubbleNodeHighlightColor(
      graphNode("file"),
      defaultGraphDrawTheme,
      categoryColors
    )).toBe(defaultGraphDrawTheme.textSecondary);
    expect(bubbleNodeHighlightColor(
      categorizedNode,
      defaultGraphDrawTheme,
      categoryColors
    )).not.toBe(defaultGraphDrawTheme.accent);
  });

  it("薄膜の反射色と透明度をテーマに合わせて生成する", () => {
    const darkTheme = { ...defaultGraphDrawTheme, background: "#11120f" };
    const color = "hsl(120 62% 40%)";

    expect(bubbleMembranePalette(color, defaultGraphDrawTheme)).toEqual({
      depth: defaultGraphDrawTheme.borderStrong,
      highlight: defaultGraphDrawTheme.background,
      interiorAlpha: 0.025,
      rimSecondary: "hsl(86 62% 40%)",
      rimTertiary: "hsl(162 62% 40%)"
    });
    expect(bubbleMembranePalette(color, darkTheme)).toEqual({
      depth: darkTheme.borderStrong,
      highlight: darkTheme.text,
      interiorAlpha: 0.04,
      rimSecondary: "hsl(158 62% 40%)",
      rimTertiary: "hsl(74 62% 40%)"
    });
    expect(bubbleMembranePalette(color, defaultGraphDrawTheme).interiorAlpha)
      .toBeLessThanOrEqual(0.04);
    expect(bubbleColorWithAlpha(color, 0.2)).toBe("hsl(120 62% 40% / 0.2)");
    expect(bubbleColorWithAlpha("#fff", 1.4)).toBe("rgba(255, 255, 255, 1)");
  });

  it("動いたバブルの輪郭内だけを操作対象として判定する", () => {
    const node = {
      ...graphNode("file"),
      category: "人物",
      fx: null,
      fy: null,
      vx: 0,
      vy: 0,
      x: 240,
      y: -30
    } satisfies BubbleSimNode;

    expect(bubbleCategoryAtWorldPoint([node], { x: 240, y: -30 })).toBe("人物");
    expect(bubbleCategoryAtWorldPoint([node], { x: 500, y: -30 })).toBeNull();
  });
});
