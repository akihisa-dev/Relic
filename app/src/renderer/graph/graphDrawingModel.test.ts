import { describe, expect, it } from "vitest";

import type { WorkspaceGraphNode } from "../../shared/ipc";
import { nodeColor } from "./graphDrawingModel";
import { defaultGraphDrawTheme, type GraphColorGroup } from "./graphTypes";

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
  it("描画時はキャッシュ済みテーマとカスタムグループ色だけを使う", () => {
    const theme = {
      ...defaultGraphDrawTheme,
      accent: "#111111",
      textMuted: "#222222",
      textSecondary: "#333333"
    };
    const groups: GraphColorGroup[] = [{ color: "#abcdef", id: "group", query: "file" }];

    expect(nodeColor(graphNode("tag"), [], [], theme)).toBe("#111111");
    expect(nodeColor(graphNode("attachment"), [], [], theme)).toBe("#222222");
    expect(nodeColor(graphNode("unresolved"), [], [], theme)).toBe("#222222");
    expect(nodeColor(graphNode("file"), [], [], theme)).toBe("#333333");
    expect(nodeColor(graphNode("file"), groups, [], theme)).toBe("#abcdef");
  });
});
