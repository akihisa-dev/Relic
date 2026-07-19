import { describe, expect, it } from "vitest";

import { codeBlockOpeningLineWithType } from "./editorCodeBlockType";

describe("editorCodeBlockType", () => {
  it("開始フェンスと字下げを保って種類名だけを書き換える", () => {
    expect(codeBlockOpeningLineWithType("  ````ts extra", "flavortext")).toBe("  ````flavortext");
    expect(codeBlockOpeningLineWithType("~~~mermaid", "")).toBe("~~~");
  });

  it("コードフェンスではない行を変更しない", () => {
    expect(codeBlockOpeningLineWithType("本文", "d2")).toBeNull();
  });
});
