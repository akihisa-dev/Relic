import { describe, expect, it } from "vitest";

import { decodeMermaidSourceAttribute, encodeMermaidSourceAttribute } from "./mermaidSourceAttribute";

describe("mermaidSourceAttribute", () => {
  it("エンコード済みMermaidソースを復元する", () => {
    const source = 'graph TD; A["<script>"]-->"B"';

    expect(decodeMermaidSourceAttribute(encodeMermaidSourceAttribute(source))).toBe(source);
  });

  it("uri prefixがない値は後方互換のためそのまま返す", () => {
    expect(decodeMermaidSourceAttribute("graph TD; A-->B")).toBe("graph TD; A-->B");
  });

  it("uri prefixがあるがURI decodeできない値は空文字列を返す", () => {
    expect(decodeMermaidSourceAttribute("uri:%E0%A4%A")).toBe("");
  });
});
