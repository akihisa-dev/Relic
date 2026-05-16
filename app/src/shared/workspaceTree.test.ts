import { describe, expect, it } from "vitest";

import type { WorkspaceTreeNode } from "./ipc";
import { collectMarkdownPaths } from "./workspaceTree";

describe("collectMarkdownPaths", () => {
  it("空のファイルツリーでは空配列を返す", () => {
    expect(collectMarkdownPaths([])).toEqual([]);
  });

  it("ネストしたファイルツリーから Markdown パスを既存順で集める", () => {
    const tree: WorkspaceTreeNode[] = [
      { name: "index", path: "index.md", type: "file" },
      {
        children: [
          { name: "draft", path: "notes/draft.md", type: "file" },
          {
            children: [
              { name: "deep", path: "notes/archive/deep.md", type: "file" }
            ],
            name: "archive",
            path: "notes/archive",
            type: "folder"
          }
        ],
        name: "notes",
        path: "notes",
        type: "folder"
      },
      { name: "later", path: "later.md", type: "file" }
    ];

    expect(collectMarkdownPaths(tree)).toEqual([
      "index.md",
      "notes/draft.md",
      "notes/archive/deep.md",
      "later.md"
    ]);
  });
});
