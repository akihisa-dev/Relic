import { describe, expect, it } from "vitest";

import {
  addRelicDiagramLine,
  addRelicFreeDrawingNode,
  diagramTypeFromMarkdownContent,
  emptyRelicDiagramMarkdownContent,
  isRelicDiagramMarkdownContent,
  moveRelicDiagramNode,
  moveRelicFreeDrawingAreaWithContents,
  parseRelicDiagramMarkdown,
  removeRelicDiagramLine,
  removeRelicDiagramNode,
  replaceRelicDiagramNodeFileReferences,
  resizeRelicDiagramNode,
  serializeRelicDiagramMarkdown,
  updateRelicDiagramLineLabel,
  updateRelicFreeDrawingNodeText
} from "./diagramMarkdown";

const diagramContent = [
  "---",
  "type: diagram",
  "title: 図解ファイル",
  "---",
  "",
  "nodes:",
  "  - id: node-1",
  "    shape: process",
  "    text: 主人公",
  "    x: 120",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "  - id: node-2",
  "    shape: decision",
  "    text: 判断",
  "    x: 380",
  "    y: 80",
  "    width: 180",
  "    height: 80",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: 対立",
  ""
].join("\n");

describe("Diagram Markdown", () => {
  it("type: diagramだけを図解ファイルとして扱う", () => {
    expect(isRelicDiagramMarkdownContent(diagramContent)).toBe(true);
    expect(diagramTypeFromMarkdownContent(diagramContent)).toBe("diagram");
    expect(isRelicDiagramMarkdownContent("---\ntype: relationship\n---\n\nnodes: []\nlines: []")).toBe(false);
    expect(isRelicDiagramMarkdownContent("---\ntype: why-tree\n---\n\nnodes: []\nlines: []")).toBe(false);
    expect(isRelicDiagramMarkdownContent("---\ntype: free-drawing\n---\n\nnodes: []\nlines: []")).toBe(false);
    expect(isRelicDiagramMarkdownContent("---\ntype: map\n---\n\nnodes: []")).toBe(false);
  });

  it("空の図解ファイルテンプレートはtype: diagramで作る", () => {
    expect(emptyRelicDiagramMarkdownContent).toContain("type: diagram");
    expect(emptyRelicDiagramMarkdownContent).toContain("title: 図解ファイル");
    expect(parseRelicDiagramMarkdown(emptyRelicDiagramMarkdownContent)).toMatchObject({
      ok: true,
      value: {
        lines: [],
        nodes: [],
        type: "diagram"
      }
    });
  });

  it("図形NodeとLineを読み込み、Markdownへ書き戻す", () => {
    const parsed = parseRelicDiagramMarkdown(diagramContent);

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        lines: [{ from: "node-1", id: "line-1", label: "対立", to: "node-2" }],
        nodes: [
          { id: "node-1", shape: "process", text: "主人公" },
          { id: "node-2", shape: "decision", text: "判断" }
        ],
        title: "図解ファイル",
        type: "diagram"
      }
    });
    if (!parsed.ok) return;

    const serialized = serializeRelicDiagramMarkdown(parsed.value);
    expect(serialized.ok).toBe(true);
    expect(serialized.ok ? serialized.value : "").toContain("type: diagram");
    expect(serialized.ok ? serialized.value : "").toContain("shape: process");
    expect(serialized.ok ? parseRelicDiagramMarkdown(serialized.value) : null).toEqual(parsed);
  });

  it("壊れた図解ファイルと旧typeを拒否する", () => {
    expect(parseRelicDiagramMarkdown("---\ntype: diagram\n---\n\nnotes: body").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: diagram\n---\n\nnodes:\n  - id: node-1\n    shape: note\n    text: メモ\n    x: 0\n    y: 0\n    width: 100\n    height: 80\nlines: []").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: relationship\n---\n\nnodes: []\nlines: []").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: why-tree\n---\n\nlabels: {}\nphenomenon: {}").ok).toBe(false);
    expect(parseRelicDiagramMarkdown("---\ntype: free-drawing\n---\n\nnodes: []\nlines: []").ok).toBe(false);
  });
});

describe("Diagram operations", () => {
  it("図形Nodeの追加、変更、移動、サイズ変更、Line編集をMarkdownへ反映する", () => {
    const addedNode = addRelicFreeDrawingNode(diagramContent, "input-output", 640, 320);
    expect(addedNode.ok ? addedNode.value.node.id : "").toBe("node-3");
    expect(addedNode.ok ? addedNode.value.content : "").toContain("shape: input-output");
    expect(addedNode.ok ? addedNode.value.content : "").toContain("text: 入出力");

    const updatedText = updateRelicFreeDrawingNodeText(diagramContent, "node-1", "新しいテキスト");
    expect(updatedText.ok ? updatedText.value.content : "").toContain("text: 新しいテキスト");

    const moved = moveRelicDiagramNode(diagramContent, "node-1", 240.4, 160.6);
    expect(moved.ok ? moved.value.content : "").toContain("x: 240");
    expect(moved.ok ? moved.value.content : "").toContain("y: 161");

    const resized = resizeRelicDiagramNode(diagramContent, "node-1", 220.4, 96.6);
    expect(resized.ok ? resized.value.content : "").toContain("width: 224");
    expect(resized.ok ? resized.value.content : "").toContain("height: 96");

    const withoutLines = diagramContent.replace([
      "lines:",
      "  - id: line-1",
      "    from: node-1",
      "    to: node-2",
      "    label: 対立"
    ].join("\n"), "lines: []");
    const addedLine = addRelicDiagramLine(withoutLines, "node-1", "node-2", "YES");
    expect(addedLine.ok ? addedLine.value.line : null).toMatchObject({ from: "node-1", label: "YES", to: "node-2" });

    const updatedLabel = updateRelicDiagramLineLabel(diagramContent, "line-1", "関連");
    expect(updatedLabel.ok ? updatedLabel.value.content : "").toContain("label: 関連");

    const removedLine = removeRelicDiagramLine(diagramContent, "line-1");
    expect(removedLine.ok ? removedLine.value.content : "").not.toContain("id: line-1");

    const removedNode = removeRelicDiagramNode(diagramContent, "node-1");
    expect(removedNode.ok ? removedNode.value.content : "").not.toContain("id: node-1");
  });

  it("領域図形を動かすと完全に内包された図形だけ一緒に動かす", () => {
    const content = [
      "---",
      "type: diagram",
      "---",
      "",
      "nodes:",
      "  - id: area-1",
      "    shape: area",
      "    text: 領域",
      "    x: 100",
      "    y: 100",
      "    width: 300",
      "    height: 200",
      "  - id: inside-1",
      "    shape: process",
      "    text: 内側",
      "    x: 140",
      "    y: 140",
      "    width: 120",
      "    height: 80",
      "  - id: outside-1",
      "    shape: process",
      "    text: 外側",
      "    x: 420",
      "    y: 140",
      "    width: 120",
      "    height: 80",
      "lines: []",
      ""
    ].join("\n");

    const moved = moveRelicFreeDrawingAreaWithContents(content, "area-1", 132, 164);

    expect(moved.ok).toBe(true);
    expect(moved.ok ? moved.value.content : "").toContain("id: inside-1\n    shape: process\n    text: 内側\n    x: 172\n    y: 204");
    expect(moved.ok ? moved.value.content : "").toContain("id: outside-1\n    shape: process\n    text: 外側\n    x: 420\n    y: 140");
  });

  it("図解ファイルにはMarkdownファイル参照Node更新を適用しない", () => {
    const replaced = replaceRelicDiagramNodeFileReferences(diagramContent, "file", "old.md", "new.md");

    expect(replaced.ok ? replaced.value : null).toEqual({ content: diagramContent, count: 0 });
  });
});
