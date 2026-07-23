import { describe, expect, it } from "vitest";

import type { WorkspaceGraphNode } from "../../shared/ipc";
import { graphCategoryBubbles, nodeColor } from "./graphDrawingModel";
import { defaultGraphDrawTheme, defaultGraphOptions, type GraphSimNode } from "./graphTypes";

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
      createNode("C.md", -80, 0)
    ], defaultGraphOptions, 1);

    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]).toMatchObject({ category: "人物", x: 30, y: 20 });
    expect(bubbles[0]!.radius).toBeGreaterThan(20);
  });
});
