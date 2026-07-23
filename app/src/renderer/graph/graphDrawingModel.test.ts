import { describe, expect, it } from "vitest";

import type { WorkspaceGraphNode } from "../../shared/ipc";
import {
  graphCategoryBubbles,
  graphCategoryColor,
  nodeColor
} from "./graphDrawingModel";
import { defaultGraphDrawTheme, type GraphSimNode } from "./graphTypes";

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

describe("graphDrawingModel", () => {
  it("描画時はキャッシュ済みテーマだけを使う", () => {
    const theme = {
      ...defaultGraphDrawTheme,
      accent: "#111111",
      textMuted: "#222222",
      textSecondary: "#333333"
    };
    expect(nodeColor(graphNode("tag"), theme)).toBe("#111111");
    expect(nodeColor(graphNode("attachment"), theme)).toBe("#222222");
    expect(nodeColor(graphNode("unresolved"), theme)).toBe("#222222");
    expect(nodeColor(graphNode("file"), theme)).toBe("#333333");
  });

  it("カテゴリを持つファイルだけを所属バブルへ含める", () => {
    const createNode = (
      id: string,
      x: number,
      y: number,
      category?: string
    ): GraphSimNode => ({
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
    const bubbles = graphCategoryBubbles([
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
    expect(nodeColor({ ...graphNode("file"), category: "人物" }, defaultGraphDrawTheme))
      .toBe(personColor);
    expect(nodeColor(graphNode("file"), defaultGraphDrawTheme))
      .toBe(defaultGraphDrawTheme.textSecondary);
  });
});
