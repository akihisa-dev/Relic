import { describe, expect, it } from "vitest";

import {
  addRelicDiagramLine,
  addRelicDiagramNodeForFile,
  diagramTypeFromMarkdownContent,
  isRelicDiagramMarkdownContent,
  moveRelicDiagramNode,
  parseRelicDiagramMarkdown,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  replaceRelicDiagramNodeFileReferences,
  serializeRelicDiagramMarkdown,
  updateRelicDiagramLineLabel,
  updateRelicDiagramNodeRole,
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
  "title: 原因分析",
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
  "  - id: node-2",
  "    file: cause.md",
  "    role: why",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: なぜ",
  ""
].join("\n");

describe("isRelicDiagramMarkdownContent", () => {
  it("relationshipとwhy-treeをDiagramとして扱い、type: mapは扱わない", () => {
    expect(isRelicDiagramMarkdownContent(relationshipContent)).toBe(true);
    expect(isRelicDiagramMarkdownContent(whyTreeContent)).toBe(true);
    expect(isRelicDiagramMarkdownContent("type: map\nnodes: []")).toBe(false);
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

  it("壊れたDiagram Markdownを拒否する", () => {
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnotes: body").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnodes:\n  - id: node-1\n    file: ../outside.md\n    x: 0\n    y: 0\n    width: 100\n    height: 80").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnodes:\n  - id: node-1\n    file: a.md\n    x: 0\n    y: 0\n    width: 100\n    height: 80\nlines:\n  - id: line-1\n    from: node-1\n    to: node-1").ok).toBe(false);
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

    const addedLine = addRelicDiagramLine(
      parseRelicDiagramMarkdown(relationshipContent).ok ? serializeWithoutLines(relationshipContent) : relationshipContent,
      "node-1",
      "node-2"
    );
    expect(addedLine.ok ? addedLine.value.line : null).toMatchObject({ from: "node-1", to: "node-2" });

    const removedNode = removeRelicDiagramNode(relationshipContent, "node-1");
    expect(removedNode.ok ? removedNode.value.content : "").not.toContain("id: node-1");

    const removedLine = removeRelicDiagramLine(relationshipContent, "line-1");
    expect(removedLine.ok ? removedLine.value.content : "").not.toContain("id: line-1");

    const updatedLabel = updateRelicDiagramLineLabel(relationshipContent, "line-1", "親友");
    expect(updatedLabel.ok ? updatedLabel.value.content : "").toContain("label: 親友");
  });
});

describe("why-tree", () => {
  it("roleを保存・復元し、role変更をMarkdownへ反映する", () => {
    const parsed = parseRelicDiagramMarkdown(whyTreeContent);
    expect(parsed.ok ? parsed.value.nodes[0]?.role : null).toBe("phenomenon");
    expect(parsed.ok ? parsed.value.nodes[1]?.role : null).toBe("why");

    const updated = updateRelicDiagramNodeRole(whyTreeContent, "node-2", "fact");
    expect(updated.ok).toBe(true);
    expect(updated.ok ? updated.value.content : "").toContain("role: fact");
    expect(updated.ok ? parseRelicDiagramMarkdown(updated.value.content).ok : false).toBe(true);
  });

  it("循環するLineを拒否する", () => {
    const cyclic = addRelicDiagramLine(whyTreeContent, "node-2", "node-1");
    expect(cyclic.ok).toBe(false);
  });

  it("Node追加時にroleをMarkdownへ保存する", () => {
    const added = addRelicDiagramNodeForFile(whyTreeContent, "fact.md");
    expect(added.ok).toBe(true);
    expect(added.ok ? added.value.node.role : null).toBe("why");
    expect(added.ok ? added.value.content : "").toContain("role: why");

    const rootOnly = [
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
    const next = addRelicDiagramNodeForFile(rootOnly, "cause.md");

    expect(next.ok).toBe(true);
    expect(next.ok ? next.value.node.role : null).toBe("why");
  });
});

function serializeWithoutLines(content: string): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return content;

  const serialized = serializeRelicDiagramMarkdown({
    ...parsed.value,
    lines: []
  });

  return serialized.ok ? serialized.value : content;
}
