import { describe, expect, it } from "vitest";

import {
  buildToolbarTableMarkdown,
  normalizeToolbarTableSize,
  toolbarPanelClass
} from "./toolbarModel";

describe("toolbarModel", () => {
  it("table size draft を既存のfallback付き数値へ正規化する", () => {
    expect(normalizeToolbarTableSize("2", "4")).toEqual({ cols: 4, rows: 2 });
    expect(normalizeToolbarTableSize("", "")).toEqual({ cols: 3, rows: 3 });
    expect(normalizeToolbarTableSize("0", "-1")).toEqual({ cols: 1, rows: 3 });
  });

  it("ToolbarのMarkdown表生成を維持する", () => {
    expect(buildToolbarTableMarkdown(2, 2, (index) => `Column ${index}`)).toBe([
      "| Column 1 | Column 2 |",
      "| --- | --- |",
      "| 　 | 　 |",
      "| 　 | 　 |"
    ].join("\n"));
  });

  it("closing panel class を既存class名で組み立てる", () => {
    expect(toolbarPanelClass("toolbar-inline-dialog", "link", "link")).toBe("toolbar-inline-dialog toolbar-panel--closing");
    expect(toolbarPanelClass("toolbar-inline-dialog", "link", "table")).toBe("toolbar-inline-dialog");
  });
});
