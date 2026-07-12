import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  isKatexCssId,
  katexWoff2OnlyCssPlugin,
  transformKatexFontCssToWoff2
} from "./katexFontCss";

describe("katexFontCss", () => {
  it("KaTeXの実CSSで全font-faceをWOFF2だけへ変換する", async () => {
    const css = await readFile(path.resolve("node_modules/katex/dist/katex.min.css"), "utf8");
    const result = transformKatexFontCssToWoff2(css);

    expect(result.fontFaceCount).toBe(20);
    expect(result.removedSourceCount).toBe(40);
    expect(result.css.match(/\.woff2\)/gu)).toHaveLength(20);
    expect(result.css).not.toMatch(/\.woff(?:["')])/u);
    expect(result.css).not.toContain(".ttf");
    expect(result.css).toContain(".katex-display");
  });

  it("文字列や括弧内のカンマを壊さずfont-faceのsrcだけを置換する", () => {
    const css = [
      "/* src: url(fake.ttf) */",
      "@font-face {",
      "  font-family: Example;",
      "  src: local(\"Example, Local\"), url(\"font.woff2?version=1\") format(\"woff2\"), url(font.ttf) format(\"truetype\");",
      "  font-display: block;",
      "}",
      ".example { background: url(\"image.ttf\"); content: \"a,b\"; }"
    ].join("\n");

    const result = transformKatexFontCssToWoff2(css);
    expect(result.css).toContain('src: url("font.woff2?version=1") format("woff2");');
    expect(result.css).toContain('.example { background: url("image.ttf"); content: "a,b"; }');
    expect(result.removedSourceCount).toBe(2);
  });

  it("WOFF2がないfont-faceは黙って壊さず失敗する", () => {
    expect(() => transformKatexFontCssToWoff2(
      '@font-face { font-family: Example; src: url(font.ttf) format("truetype"); }'
    )).toThrow("exactly one WOFF2 source");
  });

  it("KaTeX CSSだけをpre transform対象にする", () => {
    expect(isKatexCssId("/project/node_modules/katex/dist/katex.min.css?direct")).toBe(true);
    expect(isKatexCssId("C:\\project\\node_modules\\katex\\dist\\katex.css")).toBe(true);
    expect(isKatexCssId("/project/src/renderer/styles.css")).toBe(false);
    expect(katexWoff2OnlyCssPlugin().enforce).toBe("pre");
  });
});
