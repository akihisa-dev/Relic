import { describe, expect, it } from "vitest";

import type { WorkspaceTreeNode } from "../shared/ipc";
import {
  collectMarkdownPaths,
  displayNameFromPath,
  joinWorkspacePath,
  parentFolderOf
} from "./workspacePaths";

describe("workspacePaths", () => {
  it("ワークスペース相対パスを結合する", () => {
    expect(joinWorkspacePath("", "note.md")).toBe("note.md");
    expect(joinWorkspacePath("folder", "note.md")).toBe("folder/note.md");
  });

  it("親フォルダを返す", () => {
    expect(parentFolderOf("note.md")).toBe("");
    expect(parentFolderOf("folder/note.md")).toBe("folder");
    expect(parentFolderOf("a/b/note.md")).toBe("a/b");
  });

  it("表示名から Markdown 拡張子だけを外す", () => {
    expect(displayNameFromPath("note.md")).toBe("note");
    expect(displayNameFromPath("folder/note.md")).toBe("note");
    expect(displayNameFromPath("image.png")).toBe("image.png");
  });

  it("ファイルツリーから Markdown パスを集める", () => {
    const tree: WorkspaceTreeNode[] = [
      { name: "index.md", path: "index.md", type: "file" },
      {
        children: [
          { name: "draft.md", path: "notes/draft.md", type: "file" }
        ],
        name: "notes",
        path: "notes",
        type: "folder"
      }
    ];

    expect(collectMarkdownPaths(tree)).toEqual(["index.md", "notes/draft.md"]);
  });
});
