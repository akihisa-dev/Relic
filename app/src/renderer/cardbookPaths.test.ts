import { describe, expect, it } from "vitest";

import {
  displayNameFromPath,
  joinCardbookPath,
  parentCardFolderOf
} from "./cardbookPaths";

describe("cardbookPaths", () => {
  it("カードブック相対パスを結合する", () => {
    expect(joinCardbookPath("", "note.md")).toBe("note.md");
    expect(joinCardbookPath("cardFolder", "note.md")).toBe("cardFolder/note.md");
    expect(joinCardbookPath("/cardFolder\\child/", "\\note.md")).toBe("cardFolder/child/note.md");
  });

  it("親カードフォルダを返す", () => {
    expect(parentCardFolderOf("note.md")).toBe("");
    expect(parentCardFolderOf("cardFolder/note.md")).toBe("cardFolder");
    expect(parentCardFolderOf("a/b/note.md")).toBe("a/b");
  });

  it("表示名から Markdown 拡張子だけを外す", () => {
    expect(displayNameFromPath("note.md")).toBe("note");
    expect(displayNameFromPath("cardFolder/note.md")).toBe("note");
    expect(displayNameFromPath("cardFolder/NOTE.MD")).toBe("NOTE");
    expect(displayNameFromPath("image.png")).toBe("image.png");
  });

});
