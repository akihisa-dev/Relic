import { describe, expect, it } from "vitest";

import {
  appendMermaidMarkdownBlock,
  buildCanvasMermaidSource,
  findMermaidMarkdownBlocks,
  parseCanvasMermaid,
  replaceMermaidMarkdownBlock
} from "./canvasMermaid";

const reproductionMermaid = [
  "flowchart TD",
  "  A[設定を作る] --> B[Markdownに保存する]",
  "  B --> C[Relicで開く]",
  "  C --> D{mermaidコードブロック?}",
  "  D -->|はい| E[図として表示]",
  "  D -->|いいえ| F[通常のコードブロック]"
].join("\n");

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

  it("既存のgraph短縮表記と暗黙ノードをキャンバスデータへ変換する", () => {
    const result = parseCanvasMermaid("graph TD; A-->B; B-->C");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.direction).toBe("TD");
    expect(result.diagram.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["A", "A", "rectangle"],
      ["B", "B", "rectangle"],
      ["C", "C", "rectangle"]
    ]);
    expect(result.diagram.edges).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "C" }
    ]);
  });

  it("graph LRをflowchart LRと同等にキャンバスデータへ変換する", () => {
    const result = parseCanvasMermaid("graph LR; A[開始]-->B;");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.direction).toBe("LR");
    expect(result.diagram.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["A", "開始", "rectangle"],
      ["B", "B", "rectangle"]
    ]);
    expect(result.diagram.edges).toEqual([{ from: "A", to: "B" }]);
  });

  it("接続行に書かれた既存ノード形状をキャンバスデータへ変換する", () => {
    const result = parseCanvasMermaid([
      "flowchart LR",
      "  person[人物] --> place{場所}",
      "  place --> end((終端))"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["person", "人物", "rectangle"],
      ["place", "場所", "diamond"],
      ["end", "終端", "circle"]
    ]);
  });

  it("インラインノード定義付き接続を解析する", () => {
    const result = parseCanvasMermaid([
      "flowchart TD",
      "  A[開始] --> B[処理]",
      "  B --> C{確認}",
      "  C --> D((終了))"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["A", "開始", "rectangle"],
      ["B", "処理", "rectangle"],
      ["C", "確認", "diamond"],
      ["D", "終了", "circle"]
    ]);
    expect(result.diagram.edges).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "D" }
    ]);
  });

  it("ラベル付き接続を解析してCanvasEdge.labelに保持する", () => {
    const result = parseCanvasMermaid([
      "flowchart TD",
      "  D{mermaidコードブロック?}",
      "  E[図として表示]",
      "  D -->|はい| E"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.edges).toEqual([{ from: "D", label: "はい", to: "E" }]);
  });

  it("再現Mermaidを6ノード5エッジのキャンバスデータへ変換する", () => {
    const result = parseCanvasMermaid(reproductionMermaid);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["A", "設定を作る", "rectangle"],
      ["B", "Markdownに保存する", "rectangle"],
      ["C", "Relicで開く", "rectangle"],
      ["D", "mermaidコードブロック?", "diamond"],
      ["E", "図として表示", "rectangle"],
      ["F", "通常のコードブロック", "rectangle"]
    ]);
    expect(result.diagram.edges).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "D" },
      { from: "D", label: "はい", to: "E" },
      { from: "D", label: "いいえ", to: "F" }
    ]);
  });

  it("同じIDの同一再定義を許可する", () => {
    const result = parseCanvasMermaid([
      "flowchart TD",
      "  A[開始] --> B[処理]",
      "  A[開始] --> C[別処理]"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.nodes.filter((node) => node.id === "A")).toHaveLength(1);
    expect(result.diagram.nodes.find((node) => node.id === "A")).toMatchObject({
      label: "開始",
      shape: "rectangle"
    });
  });

  it("未対応構文を検出する", () => {
    expect(parseCanvasMermaid("sequenceDiagram\nAlice->>Bob: Hi").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1 -.-> node2").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1[人物]\n  node1[重複]").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1[人物]\n  node1{人物}").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1[<b>人物</b>]").ok).toBe(false);
    expect(parseCanvasMermaid("flowchart TD\n  node1 -->|<b>はい</b>| node2").ok).toBe(false);
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

  it("ラベル付きエッジをMermaidソースへ再生成する", () => {
    const source = buildCanvasMermaidSource({
      direction: "TD",
      edges: [{ from: "D", label: "はい", to: "E" }],
      nodes: [
        { id: "D", label: "mermaidコードブロック?", shape: "diamond", x: 0, y: 0 },
        { id: "E", label: "図として表示", shape: "rectangle", x: 0, y: 0 }
      ]
    });

    expect(source).toContain("  D -->|はい| E");
  });
});
