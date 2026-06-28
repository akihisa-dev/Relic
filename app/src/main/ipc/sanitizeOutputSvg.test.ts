import { describe, expect, it } from "vitest";

import {
  dangerousSvgFragments,
  forbiddenSanitizedOutputPatterns
} from "../../test/securityFixtures";
import { hasRenderableSvg, sanitizeOutputSvg } from "./sanitizeOutputSvg";

describe("sanitizeOutputSvg", () => {
  it("SVGタグ外の文字列を含む入力からSVGだけを抽出し、必要ならサニタイズする", () => {
    const result = sanitizeOutputSvg("foo <svg><path d=\"M0 0\"/></svg> bar");

    expect(result).toBe("<svg><path d=\"M0 0\"/></svg>");
  });

  it("SVGが空なら保存対象として扱わない", () => {
    expect(sanitizeOutputSvg("<svg></svg>")).toBe("<svg></svg>");
    expect(hasRenderableSvg("<svg></svg>")).toBe(false);
  });

  it("許可されないタグを除去する", () => {
    const input = "<svg><script>alert(1)</script><g><text>ok</text></g><foreignObject><rect/></foreignObject></svg>";
    const result = sanitizeOutputSvg(input);

    expect(result).toBe("<svg><g><text>ok</text></g></svg>");
    expect(hasRenderableSvg(result)).toBe(true);
  });

  it("SVG属性中のイベントハンドラを除去し、危険なURIを除去する", () => {
    const input = '<svg><text ONCLICK="alert(1)" href="java\nscript:alert(1)" xlink:href="https://example.com">safe</text></svg>';
    const result = sanitizeOutputSvg(input);

    expect(result).toBe("<svg><text>safe</text></svg>");
  });

  it("外部参照URI属性は除去する", () => {
    const input = '<svg><a href="mailto:hello@example.com" src="http://example.com/logo.svg">link</a></svg>';
    const result = sanitizeOutputSvg(input);

    expect(result).toBe("<svg><a>link</a></svg>");
  });

  it("SVG内部参照は保持する", () => {
    const input = '<svg><defs><marker id="arrow"/></defs><path marker-end="url(#arrow)" href="#arrow"/></svg>';
    const result = sanitizeOutputSvg(input);

    expect(result).toBe('<svg><defs><marker id="arrow"/></defs><path marker-end="url(#arrow)" href="#arrow"/></svg>');
  });

  it("空白入り制御文字入りの危険スキームは除去する", () => {
    const input = '<svg><a href="ja va script:alert(1)">bad</a></svg>';
    const result = sanitizeOutputSvg(input);

    expect(result).toBe("<svg><a>bad</a></svg>");
  });

  it("大文字小文字混在のタグと危険参照属性を除去する", () => {
    const input = [
      "<svg>",
      "<ForeignObject><div>unsafe</div></ForeignObject>",
      '<image HREF="file:///tmp/outside.svg" SRC="java&#x0a;script:alert(1)" />',
      '<a XLINK:HREF="https://example.com/safe.svg">safe</a>',
      "</svg>"
    ].join("");
    const result = sanitizeOutputSvg(input);

    expect(result).toBe("<svg><image/><a>safe</a></svg>");
    expect(result).not.toMatch(/foreignObject/i);
    expect(result).not.toContain("file:");
    expect(result).not.toContain("javascript:");
    expect(result).not.toContain("https:");
  });

  it("攻撃文字列コーパスを保存用SVGへ残さない", () => {
    const result = sanitizeOutputSvg([
      "<svg>",
      '<defs><marker id="arrow"/></defs>',
      '<path marker-end="url(#arrow)" href="#arrow" d="M0 0" />',
      ...dangerousSvgFragments,
      "</svg>"
    ].join(""));

    expect(result).toContain('<path marker-end="url(#arrow)" href="#arrow" d="M0 0"/>');
    for (const pattern of forbiddenSanitizedOutputPatterns) {
      expect(result).not.toMatch(pattern);
    }
    expect(hasRenderableSvg(result)).toBe(true);
  });
});
