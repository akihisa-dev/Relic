import { describe, expect, it } from "vitest";

import {
  appendMermaidMarkdownBlock,
  buildCanvasMermaidSource,
  findMermaidMarkdownBlocks,
  parseCanvasMermaid,
  replaceMermaidMarkdownBlock
} from "./canvasMermaid";

describe("canvasMermaid", () => {
  it("Markdown内のmermaidコードブロックを検出する", () => {
    const markdown = [
      "# Note",
      "",
      "```mermaid",
      "flowchart TD",
      "  node1[人物]",
      "```",
      "",
      "本文"
    ].join("\n");

    const blocks = findMermaidMarkdownBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].source).toBe("flowchart TD\n  node1[人物]");
  });

  it("対応範囲のflowchartをキャンバスデータへ変換する", () => {
    const result = parseCanvasMermaid([
      "flowchart LR",
      "  node1[人物]",
      "  node2{分岐}",
      "  node3((終端))",
      "  node1 --> node2",
      "  node2 --> node3",
      "",
      "%% relic:canvas {\"nodes\":{\"node2\":{\"x\":320,\"y\":180}}}"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.direction).toBe("LR");
    expect(result.diagram.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["node1", "人物", "rectangle"],
      ["node2", "分岐", "diamond"],
      ["node3", "終端", "circle"]
    ]);
    expect(result.diagram.nodes.find((node) => node.id === "node2")).toMatchObject({ x: 320, y: 180 });
    expect(result.diagram.edges).toEqual([
      { from: "node1", to: "node2" },
      { from: "node2", to: "node3" }
    ]);
  });

  it("未対応構文を検出する", () => {
    expect(parseCanvasMermaid("sequenceDiagram\nAlice->>Bob: Hi").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1 -.-> node2").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1[人物]\n  node1[重複]").ok).toBe(false);
  });

  it("ブロック置換時にブロック外の本文を維持する", () => {
    const markdown = "前\n\n```mermaid\nflowchart TD\n  node1[前]\n```\n\n後";
    const block = findMermaidMarkdownBlocks(markdown)[0];
    const next = replaceMermaidMarkdownBlock(markdown, block, "flowchart LR\n  node1[後]");

    expect(next).toBe("前\n\n```mermaid\nflowchart LR\n  node1[後]\n```\n\n後");
  });

  it("Markdown末尾へ新しいmermaidコードブロックを追加する", () => {
    const next = appendMermaidMarkdownBlock("# Note\n本文", "flowchart TD");

    expect(next).toBe("# Note\n本文\n\n```mermaid\nflowchart TD\n```\n");
  });

  it("キャンバスデータから対応範囲のMermaidソースを生成する", () => {
    const source = buildCanvasMermaidSource({
      direction: "TD",
      edges: [{ from: "node1", to: "node2" }],
      nodes: [
        { id: "node1", label: "人物", shape: "rectangle", x: 0, y: 0 },
        { id: "node2", label: "分岐", shape: "diamond", x: 0, y: 0 }
      ]
    });

    expect(source).toBe([
      "flowchart TD",
      "  node1[人物]",
      "  node2{分岐}",
      "  node1 --> node2",
      "",
      "%% relic:canvas {\"nodes\":{\"node1\":{\"x\":0,\"y\":0},\"node2\":{\"x\":0,\"y\":0}}}"
    ].join("\n"));
  });
});
