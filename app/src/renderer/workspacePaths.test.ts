import { describe, expect, it } from "vitest";

import {
  displayNameFromPath,
  joinWorkspacePath,
  parentFolderOf
} from "./workspacePaths";

describe("workspacePaths", () => {
  it("ワークスペース相対パスを結合する", () => {
    expect(joinWorkspacePath("", "note.md")).toBe("note.md");
    expect(joinWorkspacePath("folder", "note.md")).toBe("folder/note.md");
    expect(joinWorkspacePath("/folder\\child/", "\\note.md")).toBe("folder/child/note.md");
  });

  it("親フォルダを返す", () => {
    expect(parentFolderOf("note.md")).toBe("");
    expect(parentFolderOf("folder/note.md")).toBe("folder");
    expect(parentFolderOf("a/b/note.md")).toBe("a/b");
  });

  it("表示名から Markdown 拡張子だけを外す", () => {
    expect(displayNameFromPath("note.md")).toBe("note");
    expect(displayNameFromPath("folder/note.md")).toBe("note");
    expect(displayNameFromPath("folder/NOTE.MD")).toBe("NOTE");
    expect(displayNameFromPath("image.png")).toBe("image.png");
  });

});
