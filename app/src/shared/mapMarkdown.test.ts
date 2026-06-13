import { describe, expect, it } from "vitest";

import {
  addRelicMapNodeForFile,
  addRelicMapLine,
  isRelicMapMarkdownContent,
  moveRelicMapNode,
  parseRelicMapMarkdown,
  removeRelicMapLine,
  removeRelicMapNode,
  replaceRelicMapNodeFileReferences,
  serializeRelicMapMarkdown,
  updateRelicMapLineLabel,
  type RelicMapDocument
} from "./mapMarkdown";

const validMap = [
  "type: map",
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
  "",
  "lines:",
  "  - id: line-1",
  "    from: node-1",
  "    to: node-2",
  "    label: 幼なじみ",
  ""
].join("\n");

describe("isRelicMapMarkdownContent", () => {
  it("先頭行 type: map のMarkdownだけをMapとして扱う", () => {
    expect(isRelicMapMarkdownContent("type: map\nnodes: []")).toBe(true);
    expect(isRelicMapMarkdownContent("# Title\ntype: map")).toBe(false);
  });
});

describe("parseRelicMapMarkdown", () => {
  it("Map用MDからNodeとLineを読み込む", () => {
    const parsed = parseRelicMapMarkdown(validMap);

    expect(parsed).toEqual({
      ok: true,
      value: {
        type: "map",
        nodes: [
          {
            file: "characters/alice.md",
            height: 80,
            id: "node-1",
            width: 180,
            x: 120,
            y: 80
          },
          {
            file: "characters/bob.md",
            height: 80,
            id: "node-2",
            width: 180,
            x: 380,
            y: 80
          }
        ],
        lines: [
          {
            from: "node-1",
            id: "line-1",
            label: "幼なじみ",
            to: "node-2"
          }
        ]
      }
    });
  });

  it("壊れたMap用MDを拒否する", () => {
    expect(parseRelicMapMarkdown("type: map\n\nnotes: body").ok).toBe(false);
    expect(parseRelicMapMarkdown("type: map\n\nnodes:\n  - id: node-1\n    file: ../outside.md\n    x: 0\n    y: 0\n    width: 100\n    height: 80").ok).toBe(false);
    expect(parseRelicMapMarkdown("type: map\n\nnodes:\n  - id: node-1\n    file: a.md\n    x: 0\n    y: 0\n    width: 100\n    height: 80\nlines:\n  - id: line-1\n    from: node-1\n    to: node-1").ok).toBe(false);
  });

  it("重複Nodeと重複Lineを拒否する", () => {
    expect(parseRelicMapMarkdown([
      "type: map",
      "nodes:",
      "  - id: node-1",
      "    file: a.md",
      "    x: 0",
      "    y: 0",
      "    width: 100",
      "    height: 80",
      "  - id: node-1",
      "    file: b.md",
      "    x: 200",
      "    y: 0",
      "    width: 100",
      "    height: 80"
    ].join("\n")).ok).toBe(false);

    expect(parseRelicMapMarkdown([
      "type: map",
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
      "lines:",
      "  - id: line-1",
      "    from: node-1",
      "    to: node-2",
      "  - id: line-2",
      "    from: node-2",
      "    to: node-1"
    ].join("\n")).ok).toBe(false);
  });
});

describe("serializeRelicMapMarkdown", () => {
  it("NodeとLineをMap用MDへ書き戻す", () => {
    const map: RelicMapDocument = {
      type: "map",
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

    const serialized = serializeRelicMapMarkdown(map);

    expect(serialized.ok).toBe(true);
    expect(serialized.ok ? serialized.value : "").toBe([
      "type: map",
      "",
      "nodes:",
      "  - id: node-1",
      "    file: characters/alice.md",
      "    x: 120",
      "    y: 80",
      "    width: 180",
      "    height: 80",
      "lines: []",
      ""
    ].join("\n"));
    expect(serialized.ok ? parseRelicMapMarkdown(serialized.value).ok : false).toBe(true);
  });
});

describe("replaceRelicMapNodeFileReferences", () => {
  it("ファイル名変更に合わせてNodeの参照先を更新する", () => {
    const replaced = replaceRelicMapNodeFileReferences(
      validMap,
      "file",
      "characters/alice.md",
      "characters/alicia.md"
    );

    expect(replaced.ok).toBe(true);
    expect(replaced.ok ? replaced.value.count : 0).toBe(1);
    expect(replaced.ok ? replaced.value.content : "").toContain("file: characters/alicia.md");
    expect(replaced.ok ? replaced.value.content : "").toContain("file: characters/bob.md");
  });

  it("フォルダ移動に合わせてNodeの参照先を更新する", () => {
    const replaced = replaceRelicMapNodeFileReferences(
      validMap,
      "folder",
      "characters",
      "archive/characters"
    );

    expect(replaced.ok).toBe(true);
    expect(replaced.ok ? replaced.value.count : 0).toBe(2);
    expect(replaced.ok ? replaced.value.content : "").toContain("file: archive/characters/alice.md");
    expect(replaced.ok ? replaced.value.content : "").toContain("file: archive/characters/bob.md");
  });
});

describe("addRelicMapNodeForFile", () => {
  it("Map用MDの中央付近にNodeを追加する", () => {
    const added = addRelicMapNodeForFile("type: map\n\nnodes: []\nlines: []\n", "characters/alice.md");

    expect(added.ok).toBe(true);
    expect(added.ok ? added.value.node : null).toMatchObject({
      file: "characters/alice.md",
      height: 80,
      id: "node-1",
      width: 180,
      x: 360,
      y: 270
    });
    expect(added.ok ? added.value.content : "").toContain("file: characters/alice.md");
  });

  it("既存Nodeと重ならない位置と次のIDでNodeを追加する", () => {
    const added = addRelicMapNodeForFile(validMap, "characters/carol.md");

    expect(added.ok).toBe(true);
    expect(added.ok ? added.value.node.id : "").toBe("node-3");
    expect(added.ok ? added.value.node.file : "").toBe("characters/carol.md");
    expect(added.ok ? added.value.node.x : 0).toBeGreaterThan(120);
  });
});

describe("moveRelicMapNode", () => {
  it("Nodeの位置をMap用MDへ書き戻す", () => {
    const moved = moveRelicMapNode(validMap, "node-1", 240.4, 160.6);

    expect(moved.ok).toBe(true);
    expect(moved.ok ? moved.value.node : null).toMatchObject({
      id: "node-1",
      x: 240,
      y: 161
    });
    expect(moved.ok ? moved.value.content : "").toContain("x: 240");
    expect(moved.ok ? moved.value.content : "").toContain("y: 161");
  });
});

describe("addRelicMapLine", () => {
  it("Node同士をつなぐLineをMap用MDへ追加する", () => {
    const content = [
      "type: map",
      "",
      "nodes:",
      "  - id: node-1",
      "    file: a.md",
      "    x: 0",
      "    y: 0",
      "    width: 180",
      "    height: 80",
      "  - id: node-2",
      "    file: b.md",
      "    x: 260",
      "    y: 0",
      "    width: 180",
      "    height: 80",
      "lines: []",
      ""
    ].join("\n");

    const added = addRelicMapLine(content, "node-1", "node-2");

    expect(added.ok).toBe(true);
    expect(added.ok ? added.value.line : null).toEqual({
      from: "node-1",
      id: "line-1",
      label: "",
      to: "node-2"
    });
    expect(added.ok ? added.value.content : "").toContain("from: node-1");
    expect(added.ok ? added.value.content : "").toContain("to: node-2");
  });

  it("自分自身へのLineと重複Lineを拒否する", () => {
    expect(addRelicMapLine(validMap, "node-1", "node-1").ok).toBe(false);
    expect(addRelicMapLine(validMap, "node-2", "node-1").ok).toBe(false);
  });
});

describe("removeRelicMapNode", () => {
  it("Nodeと接続しているLineをMap用MDから削除する", () => {
    const removed = removeRelicMapNode(validMap, "node-1");

    expect(removed.ok).toBe(true);
    expect(removed.ok ? removed.value.count : 0).toBe(2);
    expect(removed.ok ? removed.value.content : "").not.toContain("id: node-1");
    expect(removed.ok ? removed.value.content : "").not.toContain("id: line-1");
    expect(removed.ok ? removed.value.content : "").toContain("id: node-2");
  });

  it("存在しないNode削除を拒否する", () => {
    expect(removeRelicMapNode(validMap, "node-missing").ok).toBe(false);
  });
});

describe("removeRelicMapLine", () => {
  it("LineだけをMap用MDから削除する", () => {
    const removed = removeRelicMapLine(validMap, "line-1");

    expect(removed.ok).toBe(true);
    expect(removed.ok ? removed.value.count : 0).toBe(1);
    expect(removed.ok ? removed.value.content : "").not.toContain("id: line-1");
    expect(removed.ok ? removed.value.content : "").toContain("id: node-1");
    expect(removed.ok ? removed.value.content : "").toContain("id: node-2");
  });

  it("存在しないLine削除を拒否する", () => {
    expect(removeRelicMapLine(validMap, "line-missing").ok).toBe(false);
  });
});

describe("updateRelicMapLineLabel", () => {
  it("LineのLabelをMap用MDへ書き戻す", () => {
    const updated = updateRelicMapLineLabel(validMap, "line-1", "親友");

    expect(updated.ok).toBe(true);
    expect(updated.ok ? updated.value.line : null).toMatchObject({
      id: "line-1",
      label: "親友"
    });
    expect(updated.ok ? updated.value.content : "").toContain("label: 親友");
    expect(updated.ok ? updated.value.content : "").toContain("id: node-1");
    expect(updated.ok ? updated.value.content : "").toContain("id: node-2");
  });

  it("存在しないLineのLabel更新を拒否する", () => {
    expect(updateRelicMapLineLabel(validMap, "line-missing", "親友").ok).toBe(false);
  });
});
