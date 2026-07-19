import { describe, expect, it } from "vitest";

import { deriveFileTreeContextTarget } from "./fileTreeContextMenuModel";

describe("fileTreeContextMenuModel", () => {
  it("Markdownだけの複数選択をファイル加工対象にする", () => {
    const target = deriveFileTreeContextTarget(
      { kind: "markdown", name: "a.md", path: "a.md", type: "file" },
      [
        { kind: "markdown", path: "a.md", type: "file" },
        { kind: "markdown", path: "notes/b.md", type: "file" }
      ],
      true
    );

    expect(target.hasMixedSelection).toBe(false);
    expect(target.toolTarget).toEqual({ kind: "files", paths: ["a.md", "notes/b.md"] });
  });

  it("Markdown以外を含む複数選択ではファイル加工対象を作らない", () => {
    const target = deriveFileTreeContextTarget(
      { kind: "markdown", name: "a.md", path: "a.md", type: "file" },
      [
        { kind: "markdown", path: "a.md", type: "file" },
        { kind: "image", path: "image.png", type: "file" }
      ],
      true
    );

    expect(target.hasMixedSelection).toBe(true);
    expect(target.toolTarget).toBeNull();
  });
});
