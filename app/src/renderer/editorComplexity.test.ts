import { Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { diagramRenderDelay, editorHeavyUpdateDelay, markdownComplexityScore } from "./editorComplexity";

describe("editorComplexity", () => {
  it("文書全体ではなく可視範囲のMarkdown密度から高負荷更新を判定する", () => {
    const plain = Text.of(["通常の本文".repeat(200)]);
    const denseTable = Text.of(Array.from({ length: 30 }, (_, index) => `| ${index} | $x_${index}$ |`));

    expect(markdownComplexityScore(plain, [{ from: 0, to: plain.length }])).toBeLessThan(120);
    expect(editorHeavyUpdateDelay(denseTable, [{ from: 0, to: denseTable.length }])).toBe(90);
  });

  it("複雑な図だけ描画開始を短く遅延する", () => {
    expect(diagramRenderDelay("graph TD\nA-->B")).toBe(0);
    expect(diagramRenderDelay(Array.from({ length: 24 }, (_, index) => `N${index}-->N${index + 1}`).join("\n"))).toBe(100);
  });
});
