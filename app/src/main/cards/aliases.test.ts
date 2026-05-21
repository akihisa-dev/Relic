import { describe, expect, it } from "vitest";

import { extractAliases } from "./aliases";

describe("extractAliases", () => {
  it("プロパティのaliasesを別名として読む", () => {
    expect(extractAliases("---\naliases:\n  - a\n  - α\n---\n# A")).toEqual(["a", "α"]);
  });

  it("文字列のaliasesも1件の別名として読む", () => {
    expect(extractAliases("---\naliases: Alpha\n---\n# A")).toEqual(["Alpha"]);
  });
});
