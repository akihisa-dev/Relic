import { describe, expect, it } from "vitest";

import { resolveCardImagePath } from "./cardViewModel";

describe("resolveCardImagePath", () => {
  it("card画像をMarkdownファイルのフォルダ基準で解決する", () => {
    expect(resolveCardImagePath("notes/story.md", "./images/moon.webp")).toBe("notes/images/moon.webp");
    expect(resolveCardImagePath("notes/chapters/story.md", "../images/moon.png")).toBe("notes/images/moon.png");
    expect(resolveCardImagePath("story.md", "images/moon.JPG")).toBe("images/moon.JPG");
  });

  it("ワークスペース外・外部URL・非対応形式を画像読込へ渡さない", () => {
    expect(resolveCardImagePath("story.md", "../moon.webp")).toBeNull();
    expect(resolveCardImagePath("story.md", "/moon.webp")).toBeNull();
    expect(resolveCardImagePath("story.md", "https://example.invalid/moon.webp")).toBeNull();
    expect(resolveCardImagePath("story.md", "images/moon.txt")).toBeNull();
  });
});
