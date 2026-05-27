import { describe, expect, it } from "vitest";

import { decodeDiagramSourceAttribute, encodeDiagramSourceAttribute } from "./diagramSourceAttribute";

describe("diagramSourceAttribute", () => {
  it("エンコード済みDiagramソースを復元する", () => {
    const source = 'graph TD; A["<script>"]-->"B"';

    expect(decodeDiagramSourceAttribute(encodeDiagramSourceAttribute(source))).toBe(source);
  });

  it("uri prefixがない値はDiagramソースとして扱わない", () => {
    expect(decodeDiagramSourceAttribute("graph TD; A-->B")).toBe("");
  });

  it("uri prefixがあるがURI decodeできない値は空文字列を返す", () => {
    expect(decodeDiagramSourceAttribute("uri:%E0%A4%A")).toBe("");
  });
});
