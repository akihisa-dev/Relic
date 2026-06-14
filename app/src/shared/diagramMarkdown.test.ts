import { describe, expect, it } from "vitest";

import {
  addRelicDiagramLine,
  addRelicDiagramNodeForFile,
  addRelicWhyTreeSupplement,
  addRelicWhyTreeWhy,
  diagramTypeFromMarkdownContent,
  isRelicDiagramMarkdownContent,
  moveRelicDiagramNode,
  moveRelicWhyTreeSupplement,
  moveRelicWhyTreeWhy,
  parseRelicDiagramMarkdown,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  removeRelicWhyTreeSupplement,
  removeRelicWhyTreeWhy,
  replaceRelicDiagramNodeFileReferences,
  resizeRelicDiagramNode,
  serializeRelicDiagramMarkdown,
  updateRelicDiagramLineLabel,
  updateRelicWhyTreeLabelPreset,
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

  it("why-treeからPhenomenon、Why、補助要素を読み込む", () => {
    const parsed = parseRelicDiagramMarkdown(whyTreeContent);

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        type: "why-tree",
        labelPreset: "generic",
        title: "売上低下分析",
        phenomenon: {
          title: "売上低下",
          facts: ["市場縮小"],
          solutions: ["新市場開拓"],
          actions: ["調査実施"],
          whys: [
            {
              title: "流入減少",
              facts: ["SEO順位低下"],
              solutions: ["SEO改善"],
              actions: ["記事改修"],
              whys: [
                {
                  title: "コンテンツ老朽化"
                }
              ]
            }
          ]
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

    const resized = resizeRelicDiagramNode(relationshipContent, "node-1", 220.4, 96.6);
    expect(resized.ok ? resized.value.content : "").toContain("width: 220");
    expect(resized.ok ? resized.value.content : "").toContain("height: 97");

    const addedLine = addRelicDiagramLine(serializeRelationshipWithoutLines(relationshipContent), "node-1", "node-2");
    expect(addedLine.ok ? addedLine.value.line : null).toMatchObject({ from: "node-1", to: "node-2" });
    expect(addRelicDiagramLine(relationshipContent, "node-1", "node-2").ok).toBe(false);
    expect(addRelicDiagramLine(relationshipContent, "node-2", "node-1").ok).toBe(true);

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
    expect(resizeRelicDiagramNode(whyTreeContent, "node-1", 100, 80).ok).toBe(false);
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
    expect(updatedWhy.ok ? updatedWhy.value.tree.phenomenon.whys[0]?.title : null).toBe("流入が減った");
    expect(updatedWhy.ok ? parseRelicDiagramMarkdown(updatedWhy.value.content).ok : false).toBe(true);
  });

  it("Whyに子Whyを追加し、補助要素をWhy配列へ混ぜない", () => {
    const added = addRelicWhyTreeWhy(whyTreeContent, [0, 0]);

    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.value.tree.phenomenon.whys[0]?.whys[0]?.title).toBe("コンテンツ老朽化");
    expect(added.value.tree.phenomenon.whys[0]?.whys[0]?.whys[0]?.title).toBe("ノード");
    expect(added.value.content).not.toContain("role:");
    expect(added.value.content).not.toContain("nodes:");
  });

  it("選択したノードの子として複数のWhyを追加できる", () => {
    const first = addRelicWhyTreeWhy(whyTreeContent, []);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = addRelicWhyTreeWhy(first.value.content, []);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.tree.phenomenon.whys.map((why) => why.title)).toEqual(["流入減少", "ノード", "ノード"]);

    const child = addRelicWhyTreeWhy(second.value.content, [0]);
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(child.value.tree.phenomenon.whys[0]?.whys.map((why) => why.title)).toEqual(["コンテンツ老朽化", "ノード"]);
    expect(child.value.content).toContain("whys:");
    expect(child.value.content).not.toContain("\n  why:");
  });

  it("Fact、Solution、Actionを抽象ラベルで追加・更新し、Markdownから復元する", () => {
    const withFact = addRelicWhyTreeSupplement(whyTreeContent, [0], "fact");
    expect(withFact.ok ? withFact.value.tree.phenomenon.whys[0]?.facts : []).toContain("メモ");

    const withSolution = addRelicWhyTreeSupplement(withFact.ok ? withFact.value.content : whyTreeContent, [0], "solution");
    expect(withSolution.ok ? withSolution.value.tree.phenomenon.whys[0]?.solutions : []).toContain("関連項目");

    const withAction = addRelicWhyTreeSupplement(withSolution.ok ? withSolution.value.content : whyTreeContent, [0], "action");
    expect(withAction.ok ? withAction.value.tree.phenomenon.whys[0]?.actions : []).toContain("アクション");

    const updated = updateRelicWhyTreeSupplement(withAction.ok ? withAction.value.content : whyTreeContent, [0], "action", 1, "記事改修を実行");
    expect(updated.ok ? updated.value.tree.phenomenon.whys[0]?.actions[1] : null).toBe("記事改修を実行");
    expect(updated.ok ? parseRelicDiagramMarkdown(updated.value.content) : null).toMatchObject({
      ok: true,
      value: {
        type: "why-tree",
        phenomenon: {
          whys: [
            {
              actions: ["記事改修", "記事改修を実行"]
            }
          ]
        }
      }
    });
  });

  it("問題・現象以外のWhyと補助要素を削除し、Markdownから復元する", () => {
    const removedWhy = removeRelicWhyTreeWhy(whyTreeContent, [0]);
    expect(removedWhy.ok).toBe(true);
    if (!removedWhy.ok) return;
    expect(removedWhy.value.tree.phenomenon.whys).toEqual([]);
    expect(removedWhy.value.content).not.toContain("title: 流入減少");
    expect(parseRelicDiagramMarkdown(removedWhy.value.content).ok).toBe(true);

    const removedFact = removeRelicWhyTreeSupplement(whyTreeContent, [0], "fact", 0);
    expect(removedFact.ok ? removedFact.value.tree.phenomenon.whys[0]?.facts : null).toEqual([]);

    expect(removeRelicWhyTreeWhy(whyTreeContent, []).ok).toBe(false);
    expect(removeRelicWhyTreeSupplement(whyTreeContent, [0], "action", 9).ok).toBe(false);
  });

  it("同じ親を持つWhyと補助要素を並べ替え、Markdownから復元する", () => {
    const withSecondWhy = addRelicWhyTreeWhy(whyTreeContent, []);
    expect(withSecondWhy.ok).toBe(true);
    if (!withSecondWhy.ok) return;

    const movedWhy = moveRelicWhyTreeWhy(withSecondWhy.value.content, [1], "up");
    expect(movedWhy.ok).toBe(true);
    if (!movedWhy.ok) return;
    expect(movedWhy.value.tree.phenomenon.whys.map((why) => why.title)).toEqual(["ノード", "流入減少"]);
    expect(parseRelicDiagramMarkdown(movedWhy.value.content).ok).toBe(true);

    const withSecondFact = addRelicWhyTreeSupplement(movedWhy.value.content, [1], "fact");
    expect(withSecondFact.ok).toBe(true);
    if (!withSecondFact.ok) return;

    const movedFact = moveRelicWhyTreeSupplement(withSecondFact.value.content, [1], "fact", 1, "up");
    expect(movedFact.ok).toBe(true);
    if (!movedFact.ok) return;
    expect(movedFact.value.tree.phenomenon.whys[1]?.facts).toEqual(["メモ", "SEO順位低下"]);
    expect(parseRelicDiagramMarkdown(movedFact.value.content).ok).toBe(true);
  });

  it("ラベルプリセットを保存し、原因分析ラベルの初期値にも切り替えられる", () => {
    const changed = updateRelicWhyTreeLabelPreset(whyTreeContent, "analysis");
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;

    expect(changed.value.content).toContain("labelPreset: analysis");

    const addedWhy = addRelicWhyTreeWhy(changed.value.content, []);
    expect(addedWhy.ok ? addedWhy.value.tree.phenomenon.whys[1]?.title : null).toBe("原因");

    const addedFact = addRelicWhyTreeSupplement(changed.value.content, [0], "fact");
    expect(addedFact.ok ? addedFact.value.tree.phenomenon.whys[0]?.facts : []).toContain("根拠");
  });

  it("存在しないWhyパスや循環は表現しない", () => {
    expect(addRelicWhyTreeWhy(whyTreeContent, [1]).ok).toBe(false);
    expect(addRelicWhyTreeSupplement(whyTreeContent, [0, 1], "fact").ok).toBe(false);
    expect(updateRelicWhyTreeTitle(whyTreeContent, [0, 0, 0], "存在しないWhy").ok).toBe(false);
    expect(moveRelicWhyTreeWhy(whyTreeContent, [], "down").ok).toBe(false);
    expect(moveRelicWhyTreeWhy(whyTreeContent, [0], "up").ok).toBe(false);
    expect(moveRelicWhyTreeSupplement(whyTreeContent, [0], "fact", 0, "up").ok).toBe(false);
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
