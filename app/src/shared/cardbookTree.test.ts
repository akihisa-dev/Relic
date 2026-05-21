import { describe, expect, it } from "vitest";

import type { CardbookTreeNode } from "./ipc";
import { collectMarkdownCardPaths } from "./cardbookTree";

describe("collectMarkdownCardPaths", () => {
  it("空のカードツリーでは空配列を返す", () => {
    expect(collectMarkdownCardPaths([])).toEqual([]);
  });

  it("ネストしたカードツリーから Markdown パスを既存順で集める", () => {
    const tree: CardbookTreeNode[] = [
      { name: "index", path: "index.md", type: "card" },
      {
        children: [
          { name: "draft", path: "notes/draft.md", type: "card" },
          {
            children: [
              { name: "deep", path: "notes/archive/deep.md", type: "card" }
            ],
            name: "archive",
            path: "notes/archive",
            type: "cardFolder"
          }
        ],
        name: "notes",
        path: "notes",
        type: "cardFolder"
      },
      { name: "later", path: "later.md", type: "card" }
    ];

    expect(collectMarkdownCardPaths(tree)).toEqual([
      "index.md",
      "notes/draft.md",
      "notes/archive/deep.md",
      "later.md"
    ]);
  });
});
