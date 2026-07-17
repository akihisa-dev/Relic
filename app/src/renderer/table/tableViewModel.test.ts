import { describe, expect, it } from "vitest";

import type { WorkspaceTableRow } from "../../shared/ipc";
import { duplicateFileNames, nextTableSort, sortTableRows, visibleTableRange } from "./tableViewModel";

const rows: WorkspaceTableRow[] = [
  { frontmatterStatus: "valid", name: "file10", path: "b/file10.md", properties: { count: { kind: "number", numberValue: 10, text: "10" } } },
  { frontmatterStatus: "none", name: "file2", path: "file2.md", properties: {} },
  { frontmatterStatus: "valid", name: "file2", path: "a/file2.md", properties: { count: { kind: "number", numberValue: 2, text: "2" } } },
  { frontmatterStatus: "none", name: "file3", path: "file3.md", properties: {} }
];

describe("tableViewModel", () => {
  it("ファイル名を自然順、同名を相対パス順で安定して並べる", () => {
    expect(sortTableRows(rows, { direction: "asc", property: null }).map((row) => row.path)).toEqual([
      "a/file2.md",
      "file2.md",
      "file3.md",
      "b/file10.md"
    ]);
    expect(duplicateFileNames(rows)).toEqual(new Set(["file2"]));
  });

  it("数値を数値順にし、空値は降順でも末尾へ置く", () => {
    expect(sortTableRows(rows, { direction: "asc", property: "count" }).map((row) => row.path)).toEqual([
      "a/file2.md",
      "b/file10.md",
      "file2.md",
      "file3.md"
    ]);
    expect(sortTableRows(rows, { direction: "desc", property: "count" }).map((row) => row.path)).toEqual([
      "b/file10.md",
      "a/file2.md",
      "file2.md",
      "file3.md"
    ]);
  });

  it("同じ列だけ昇降順を切り替え、表示範囲へ余白を加える", () => {
    expect(nextTableSort({ direction: "asc", property: null }, null)).toEqual({ direction: "desc", property: null });
    expect(nextTableSort({ direction: "desc", property: null }, "status")).toEqual({ direction: "asc", property: "status" });
    expect(visibleTableRange(1000, 480, 480, 48, 2)).toEqual({ start: 8, end: 22 });
  });
});
