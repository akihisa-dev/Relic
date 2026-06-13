import { describe, expect, it } from "vitest";

import {
  addRelicMapNodeForFile,
  isRelicMapMarkdownContent,
  parseRelicMapMarkdown,
  replaceRelicMapNodeFileReferences,
  serializeRelicMapMarkdown,
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
