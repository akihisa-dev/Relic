import { describe, expect, it } from "vitest";

import {
  appendMermaidMarkdownBlock,
  buildMermaidSource,
  findMermaidMarkdownBlocks,
  hashMermaidSource,
  parseMermaidFlowchart,
  replaceMermaidMarkdownBlock,
  resolveMermaidMarkdownBlock
} from "./mermaidFlowchart";

const reproductionMermaid = [
  "flowchart TD",
  "  A[設定を作る] --> B[Markdownに保存する]",
  "  B --> C[Relicで開く]",
  "  C --> D{mermaidコードブロック?}",
  "  D -->|はい| E[図として表示]",
  "  D -->|いいえ| F[通常のコードブロック]"
].join("\n");

describe("mermaidFlowchart", () => {
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

  it("対応範囲のflowchartを座標なしのMermaidモデルへ変換する", () => {
    const result = parseMermaidFlowchart([
      "flowchart LR",
      "  node1[人物]",
      "  node2{分岐}",
      "  node3((終端))",
      "  node1 --> node2",
      "  node2 --> node3"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.direction).toBe("LR");
    expect(result.model.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["node1", "人物", "rectangle"],
      ["node2", "分岐", "diamond"],
      ["node3", "終端", "circle"]
    ]);
    expect(result.model.nodes[0]).not.toHaveProperty("x");
    expect(result.model.nodes[0]).not.toHaveProperty("y");
    expect(result.model.connections).toEqual([
      { from: "node1", to: "node2" },
      { from: "node2", to: "node3" }
    ]);
  });

  it("parse処理はrelic:canvas metadataに依存しない", () => {
    const result = parseMermaidFlowchart([
      "flowchart TD",
      "  node1[人物]",
      "%% relic:canvas {\"nodes\":{\"node1\":{\"x\":320,\"y\":180}}}"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.nodes).toEqual([{ id: "node1", label: "人物", shape: "rectangle" }]);
  });

  it("既存のgraph短縮表記と暗黙ノードをMermaidモデルへ変換する", () => {
    const result = parseMermaidFlowchart("graph TD; A-->B; B-->C");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.direction).toBe("TD");
    expect(result.model.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["A", "A", "rectangle"],
      ["B", "B", "rectangle"],
      ["C", "C", "rectangle"]
    ]);
    expect(result.model.connections).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "C" }
    ]);
  });

  it("TD/LR/TB/BT/RLを解析できる", () => {
    for (const direction of ["TD", "LR", "TB", "BT", "RL"] as const) {
      const result = parseMermaidFlowchart(`flowchart ${direction}\n  A[Start]`);

      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.model.direction).toBe(direction);
    }
  });

  it("graphは読み取り、保存時にflowchartへ正規化する", () => {
    const result = parseMermaidFlowchart("graph RL\n  A[Start] --> B{Next}");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(buildMermaidSource(result.model)).toBe([
      "flowchart RL",
      "  A[Start]",
      "  B{Next}",
      "  A --> B"
    ].join("\n"));
  });

  it("接続行に書かれた既存ノード形状をMermaidモデルへ変換する", () => {
    const result = parseMermaidFlowchart([
      "flowchart LR",
      "  person[人物] --> place{場所}",
      "  place --> end((終端))"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["person", "人物", "rectangle"],
      ["place", "場所", "diamond"],
      ["end", "終端", "circle"]
    ]);
  });

  it("ラベル付き接続を解析してMermaidConnection.labelに保持する", () => {
    const result = parseMermaidFlowchart([
      "flowchart TD",
      "  D{mermaidコードブロック?}",
      "  E[図として表示]",
      "  D -->|はい| E"
    ].join("\n"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.connections).toEqual([{ from: "D", label: "はい", to: "E" }]);
  });

  it("再現Mermaidを6ノード5接続のMermaidモデルへ変換する", () => {
    const result = parseMermaidFlowchart(reproductionMermaid);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.nodes.map((node) => [node.id, node.label, node.shape])).toEqual([
      ["A", "設定を作る", "rectangle"],
      ["B", "Markdownに保存する", "rectangle"],
      ["C", "Relicで開く", "rectangle"],
      ["D", "mermaidコードブロック?", "diamond"],
      ["E", "図として表示", "rectangle"],
      ["F", "通常のコードブロック", "rectangle"]
    ]);
    expect(result.model.connections).toEqual([
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "D" },
      { from: "D", label: "はい", to: "E" },
      { from: "D", label: "いいえ", to: "F" }
    ]);
  });

  it("未対応構文を検出する", () => {
    expect(parseMermaidFlowchart("sequenceDiagram\nAlice->>Bob: Hi").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  node1 -.-> node2").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  node1[人物]\n  node1[重複]").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  node1[人物]\n  node1{人物}").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  node1[<b>人物</b>]").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  node1 -->|<b>はい</b>| node2").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  subgraph one\n  A --> B\n  end").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  classDef important fill:#fff").ok).toBe(false);
    expect(parseMermaidFlowchart("flowchart TD\n  click A callback").ok).toBe(false);
  });

  it("ブロック置換時にブロック外の本文を維持する", () => {
    const markdown = "前\n\n```mermaid\nflowchart TD\n  node1[前]\n```\n\n後";
    const block = findMermaidMarkdownBlocks(markdown)[0];
    const next = replaceMermaidMarkdownBlock(markdown, block, "flowchart LR\n  node1[後]");

    expect(next).toBe("前\n\n```mermaid\nflowchart LR\n  node1[後]\n```\n\n後");
  });

  it("Markdownブロックをhashと位置情報から再特定する", () => {
    const markdown = [
      "# Note",
      "",
      "```mermaid",
      "flowchart TD",
      "  A[One]",
      "```",
      "",
      "```mermaid",
      "flowchart TD",
      "  B[Two]",
      "```"
    ].join("\n");
    const blocks = findMermaidMarkdownBlocks(markdown);

    expect(resolveMermaidMarkdownBlock(blocks, {
      blockFrom: blocks[1].from,
      blockIndex: 1,
      blockTo: blocks[1].to,
      source: blocks[1].source,
      sourceHash: hashMermaidSource(blocks[1].source)
    })?.source).toBe("flowchart TD\n  B[Two]");
  });

  it("対象ブロックが一意に決まらない場合は再特定しない", () => {
    const markdown = [
      "```mermaid",
      "flowchart TD",
      "  B[Two]",
      "```",
      "",
      "```mermaid",
      "flowchart TD",
      "  B[Two]",
      "```"
    ].join("\n");
    const blocks = findMermaidMarkdownBlocks(markdown);

    expect(resolveMermaidMarkdownBlock(blocks, {
      blockFrom: 1000,
      blockIndex: 9,
      blockTo: 1100,
      source: "flowchart TD\n  B[Two]",
      sourceHash: hashMermaidSource("flowchart TD\n  B[Two]")
    })).toBeNull();
  });

  it("Markdown末尾へ新しいmermaidコードブロックを追加する", () => {
    const next = appendMermaidMarkdownBlock("# Note\n本文", "flowchart TD");

    expect(next).toBe("# Note\n本文\n\n```mermaid\nflowchart TD\n```\n");
  });

  it("Mermaidモデルから対応範囲のソースをmetadataなしで生成する", () => {
    const source = buildMermaidSource({
      direction: "TD",
      connections: [{ from: "node1", to: "node2" }],
      nodes: [
        { id: "node1", label: "人物", shape: "rectangle" },
        { id: "node2", label: "分岐", shape: "diamond" }
      ]
    });

    expect(source).toBe([
      "flowchart TD",
      "  node1[人物]",
      "  node2{分岐}",
      "  node1 --> node2"
    ].join("\n"));
    expect(source).not.toContain("%% relic:canvas");
  });

  it("ラベル付き接続をMermaidソースへ再生成する", () => {
    const source = buildMermaidSource({
      direction: "TD",
      connections: [{ from: "D", label: "はい", to: "E" }],
      nodes: [
        { id: "D", label: "mermaidコードブロック?", shape: "diamond" },
        { id: "E", label: "図として表示", shape: "rectangle" }
      ]
    });

    expect(source).toContain("  D -->|はい| E");
  });
});
