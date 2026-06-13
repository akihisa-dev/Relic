import { describe, expect, it } from "vitest";

import {
  isRelicMapMarkdownContent,
  parseRelicMapMarkdown,
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
