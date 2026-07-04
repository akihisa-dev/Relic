import { describe, expect, it } from "vitest";

import { shouldExtractOutlineHeadings } from "./useActiveDocumentContext";

describe("shouldExtractOutlineHeadings", () => {
  it("右パネルが開いていてoutline表示かつ有効な編集対象のときのみ抽出する", () => {
    expect(shouldExtractOutlineHeadings(true, "outline", false, true)).toBe(true);
    expect(shouldExtractOutlineHeadings(true, "outline", true, true)).toBe(false);
    expect(shouldExtractOutlineHeadings(true, "links", false, true)).toBe(false);
    expect(shouldExtractOutlineHeadings(false, "outline", false, true)).toBe(false);
    expect(shouldExtractOutlineHeadings(true, "outline", false, false)).toBe(false);
  });
});
