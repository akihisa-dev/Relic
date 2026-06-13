import { describe, expect, it } from "vitest";

import {
  addRelicDiagramLine,
  addRelicDiagramNodeForFile,
  addRelicWhyTreeSupplement,
  addRelicWhyTreeWhy,
  diagramTypeFromMarkdownContent,
  isRelicDiagramMarkdownContent,
  moveRelicDiagramNode,
  parseRelicDiagramMarkdown,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  removeRelicWhyTreeSupplement,
  removeRelicWhyTreeWhy,
  replaceRelicDiagramNodeFileReferences,
  serializeRelicDiagramMarkdown,
  updateRelicDiagramLineLabel,
  updateRelicWhyTreeSupplement,
  updateRelicWhyTreeTitle,
  type RelicDiagramDocument
} from "./diagramMarkdown";

const relationshipContent = [
  "---",
  "type: relationship",
  "title: 関係図",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    file: characters/alice.md",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    file: characters/bob.md",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: 幼なじみ",
  ""
].join("\n");

const whyTreeContent = [
  "---",
  "type: why-tree",
  "title: 売上低下分析",
  "---",
  "",
  "phenomenon:",
  "  title: 売上低下",
  "  facts:",
  "    - 市場縮小",
  "  solutions:",
  "    - 新市場開拓",
  "  actions:",
  "    - 調査実施",
  "  why:",
  "    title: 流入減少",
  "    facts:",
  "      - SEO順位低下",
  "    solutions:",
  "      - SEO改善",
  "    actions:",
  "      - 記事改修",
  "    why:",
  "      title: コンテンツ老朽化",
  "      facts: []",
  "      solutions: []",
  "      actions: []",
  ""
].join("\n");

const relationshipLikeWhyTreeContent = [
  "---",
  "type: why-tree",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    file: problem.md",
  "    role: phenomenon",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines: []",
  ""
].join("\n");

describe("isRelicDiagramMarkdownContent", () => {
  it("relationshipとwhy-treeをDiagramとして扱い、type: mapは扱わない", () => {
    expect(isRelicDiagramMarkdownContent(relationshipContent)).toBe(true);
    expect(isRelicDiagramMarkdownContent(whyTreeContent)).toBe(true);
    expect(isRelicDiagramMarkdownContent("---\ntype: map\n---\n\nnodes: []")).toBe(false);
    expect(diagramTypeFromMarkdownContent(relationshipContent)).toBe("relationship");
    expect(diagramTypeFromMarkdownContent(whyTreeContent)).toBe("why-tree");
  });
});

describe("parseRelicDiagramMarkdown", () => {
  it("relationshipからNodeとLineを読み込む", () => {
    const parsed = parseRelicDiagramMarkdown(relationshipContent);

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        type: "relationship",
        title: "関係図",
        nodes: [
          { file: "characters/alice.md", id: "node-1" },
          { file: "characters/bob.md", id: "node-2" }
        ],
        lines: [
          { from: "node-1", id: "line-1", label: "幼なじみ", to: "node-2" }
        ]
      }
    });
  });

  it("why-treeからPhenomenon、Why Chain、補助要素を読み込む", () => {
    const parsed = parseRelicDiagramMarkdown(whyTreeContent);

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        type: "why-tree",
        title: "売上低下分析",
        phenomenon: {
          title: "売上低下",
          facts: ["市場縮小"],
          solutions: ["新市場開拓"],
          actions: ["調査実施"],
          why: {
            title: "流入減少",
            facts: ["SEO順位低下"],
            solutions: ["SEO改善"],
            actions: ["記事改修"],
            why: {
              title: "コンテンツ老朽化"
            }
          }
        }
      }
    });
  });

  it("壊れたDiagram Markdownを拒否する", () => {
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnotes: body").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnodes:\n  - id: node-1\n    file: ../outside.md\n    x: 0\n    y: 0\n    width: 100\n    height: 80").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnodes:\n  - id: node-1\n    file: a.md\n    x: 0\n    y: 0\n    width: 100\n    height: 80\nlines:\n  - id: line-1\n    from: node-1\n    to: node-1").ok).toBe(false);
  });

  it("why-treeではRelationship型のnodes/linesやphenomenon欠落を拒否する", () => {
    expect(parseRelicDiagramMarkdown(relationshipLikeWhyTreeContent).ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: why-tree\n---\n\nwhy:\n  title: 原因").ok).toBe(false);
  });

  it("relationshipでは循環と多対多を許可する", () => {
    const parsed = parseRelicDiagramMarkdown([
      "---",
      "type: relationship",
      "---",
      "",
      "nodes:",
      "  - id: node-1",
      "    file: a.md",
      "    x: 0",
      "    y: 0",
      "    width: 100",
      "    height: 80",
      "  - id: node-2",
      "    file: b.md",
      "    x: 200",
      "    y: 0",
      "    width: 100",
      "    height: 80",
      "  - id: node-3",
      "    file: c.md",
      "    x: 400",
      "    y: 0",
      "    width: 100",
      "    height: 80",
      "lines:",
      "  - id: line-1",
      "    from: node-1",
      "    to: node-2",
      "  - id: line-2",
      "    from: node-2",
      "    to: node-1",
      "  - id: line-3",
      "    from: node-3",
      "    to: node-2"
    ].join("\n"));

    expect(parsed.ok).toBe(true);
  });
});

describe("serializeRelicDiagramMarkdown", () => {
  it("relationshipをDiagram Markdownへ書き戻す", () => {
    const diagram: RelicDiagramDocument = {
      type: "relationship",
      title: "関係図",
      nodes: [
        {
          file: "characters/alice.md",
          height: 80,
          id: "node-1",
          width: 180,
          x: 120,
          y: 80
        }
      ],
      lines: []
    };

    const serialized = serializeRelicDiagramMarkdown(diagram);

    expect(serialized.ok).toBe(true);
    expect(serialized.ok ? serialized.value : "").toContain("type: relationship");
    expect(serialized.ok ? serialized.value : "").toContain("title: 関係図");
    expect(serialized.ok ? parseRelicDiagramMarkdown(serialized.value).ok : false).toBe(true);
  });

  it("why-treeをMarkdownへ書き戻し、完全復元できる", () => {
    const parsed = parseRelicDiagramMarkdown(whyTreeContent);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const serialized = serializeRelicDiagramMarkdown(parsed.value);
    expect(serialized.ok).toBe(true);
    if (!serialized.ok) return;

    expect(serialized.value).toContain("type: why-tree");
    expect(serialized.value).toContain("phenomenon:");
    expect(serialized.value).toContain("title: 流入減少");
    expect(serialized.value).not.toContain("nodes:");
    expect(serialized.value).not.toContain("lines:");
    expect(parseRelicDiagramMarkdown(serialized.value)).toEqual(parsed);
  });
});

describe("relationship operations", () => {
  it("Node参照更新、Node追加、移動、Line追加、削除、Label更新をMarkdownへ反映する", () => {
    const replaced = replaceRelicDiagramNodeFileReferences(
      relationshipContent,
      "file",
      "characters/alice.md",
      "characters/alicia.md"
    );
    expect(replaced.ok ? replaced.value.content : "").toContain("file: characters/alicia.md");

    const addedNode = addRelicDiagramNodeForFile(relationshipContent, "characters/carol.md");
    expect(addedNode.ok ? addedNode.value.node.id : "").toBe("node-3");

    const moved = moveRelicDiagramNode(relationshipContent, "node-1", 240.4, 160.6);
    expect(moved.ok ? moved.value.content : "").toContain("x: 240");
    expect(moved.ok ? moved.value.content : "").toContain("y: 161");

    const addedLine = addRelicDiagramLine(serializeRelationshipWithoutLines(relationshipContent), "node-1", "node-2");
    expect(addedLine.ok ? addedLine.value.line : null).toMatchObject({ from: "node-1", to: "node-2" });

    const removedNode = removeRelicDiagramNode(relationshipContent, "node-1");
    expect(removedNode.ok ? removedNode.value.content : "").not.toContain("id: node-1");

    const removedLine = removeRelicDiagramLine(relationshipContent, "line-1");
    expect(removedLine.ok ? removedLine.value.content : "").not.toContain("id: line-1");

    const updatedLabel = updateRelicDiagramLineLabel(relationshipContent, "line-1", "親友");
    expect(updatedLabel.ok ? updatedLabel.value.content : "").toContain("label: 親友");
  });

  it("why-treeにRelationship操作を適用しない", () => {
    expect(addRelicDiagramNodeForFile(whyTreeContent, "memo.md").ok).toBe(false);
    expect(addRelicDiagramLine(whyTreeContent, "node-1", "node-2").ok).toBe(false);
    expect(moveRelicDiagramNode(whyTreeContent, "node-1", 1, 2).ok).toBe(false);
    expect(removeRelicDiagramNode(whyTreeContent, "node-1").ok).toBe(false);
    expect(removeRelicDiagramLine(whyTreeContent, "line-1").ok).toBe(false);
    expect(updateRelicDiagramLineLabel(whyTreeContent, "line-1", "label").ok).toBe(false);

    const replaced = replaceRelicDiagramNodeFileReferences(whyTreeContent, "file", "a.md", "b.md");
    expect(replaced.ok ? replaced.value : null).toEqual({ content: whyTreeContent, count: 0 });
  });
});

describe("why-tree operations", () => {
  it("PhenomenonとWhyのtitleをMarkdownへ保存し復元する", () => {
    const updatedPhenomenon = updateRelicWhyTreeTitle(whyTreeContent, [], "売上が下がった");
    expect(updatedPhenomenon.ok ? updatedPhenomenon.value.content : "").toContain("title: 売上が下がった");

    const updatedWhy = updateRelicWhyTreeTitle(updatedPhenomenon.ok ? updatedPhenomenon.value.content : whyTreeContent, [0], "流入が減った");
    expect(updatedWhy.ok ? updatedWhy.value.tree.phenomenon.why?.title : null).toBe("流入が減った");
    expect(updatedWhy.ok ? parseRelicDiagramMarkdown(updatedWhy.value.content).ok : false).toBe(true);
  });

  it("Why ChainにWhyを追加し、補助要素をWhy Chainへ混ぜない", () => {
    const added = addRelicWhyTreeWhy(whyTreeContent, [0, 0]);

    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.value.tree.phenomenon.why?.why?.title).toBe("コンテンツ老朽化");
    expect(added.value.tree.phenomenon.why?.why?.why?.title).toBe("なぜ？");
    expect(added.value.content).not.toContain("role:");
    expect(added.value.content).not.toContain("nodes:");
  });

  it("Fact、Solution、Actionを追加・更新し、Markdownから復元する", () => {
    const withFact = addRelicWhyTreeSupplement(whyTreeContent, [0], "fact");
    expect(withFact.ok ? withFact.value.tree.phenomenon.why?.facts : []).toContain("根拠");

    const withSolution = addRelicWhyTreeSupplement(withFact.ok ? withFact.value.content : whyTreeContent, [0], "solution");
    expect(withSolution.ok ? withSolution.value.tree.phenomenon.why?.solutions : []).toContain("解決策");

    const withAction = addRelicWhyTreeSupplement(withSolution.ok ? withSolution.value.content : whyTreeContent, [0], "action");
    expect(withAction.ok ? withAction.value.tree.phenomenon.why?.actions : []).toContain("実行項目");

    const updated = updateRelicWhyTreeSupplement(withAction.ok ? withAction.value.content : whyTreeContent, [0], "action", 1, "記事改修を実行");
    expect(updated.ok ? updated.value.tree.phenomenon.why?.actions[1] : null).toBe("記事改修を実行");
    expect(updated.ok ? parseRelicDiagramMarkdown(updated.value.content) : null).toMatchObject({
      ok: true,
      value: {
        type: "why-tree",
        phenomenon: {
          why: {
            actions: ["記事改修", "記事改修を実行"]
          }
        }
      }
    });
  });

  it("問題・現象以外のWhyと補助要素を削除し、Markdownから復元する", () => {
    const removedWhy = removeRelicWhyTreeWhy(whyTreeContent, [0]);
    expect(removedWhy.ok).toBe(true);
    if (!removedWhy.ok) return;
    expect(removedWhy.value.tree.phenomenon.why?.title).toBe("コンテンツ老朽化");
    expect(removedWhy.value.content).not.toContain("title: 流入減少");
    expect(parseRelicDiagramMarkdown(removedWhy.value.content).ok).toBe(true);

    const removedFact = removeRelicWhyTreeSupplement(whyTreeContent, [0], "fact", 0);
    expect(removedFact.ok ? removedFact.value.tree.phenomenon.why?.facts : null).toEqual([]);

    expect(removeRelicWhyTreeWhy(whyTreeContent, []).ok).toBe(false);
    expect(removeRelicWhyTreeSupplement(whyTreeContent, [0], "action", 9).ok).toBe(false);
  });

  it("Why Chainのパスは単一直列だけを許可し、横断リンクや循環を表現しない", () => {
    expect(addRelicWhyTreeWhy(whyTreeContent, [1]).ok).toBe(false);
    expect(addRelicWhyTreeSupplement(whyTreeContent, [0, 1], "fact").ok).toBe(false);
    expect(updateRelicWhyTreeTitle(whyTreeContent, [0, 0, 0], "存在しないWhy").ok).toBe(false);
  });
});

function serializeRelationshipWithoutLines(content: string): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok || parsed.value.type !== "relationship") return content;

  const serialized = serializeRelicDiagramMarkdown({
    ...parsed.value,
    lines: []
  });

  return serialized.ok ? serialized.value : content;
}
