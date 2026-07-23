import { describe, expect, it } from "vitest";

import type { WorkspaceTableRow } from "../../shared/ipc";
import {
  filterTableRows,
  duplicateFileNames,
  nextTableSort,
  reorderTableProperties,
  sortTableRows,
  tableColumnDragOffsets,
  tableColumnWidth,
  visibleTableRange,
  withTableColumnWidth
} from "./tableViewModel";
import { defaultWorkspaceTablePreferences } from "../../shared/ipc";

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

  it("プロパティ列をドロップ位置の前後へ移動する", () => {
    expect(reorderTableProperties(["count", "status", "tags"], "tags", "count", "before"))
      .toEqual(["tags", "count", "status"]);
    expect(reorderTableProperties(["count", "status", "tags"], "count", "status", "after"))
      .toEqual(["status", "count", "tags"]);
    expect(reorderTableProperties(["count", "status"], "count", "count", "after"))
      .toEqual(["count", "status"]);
  });

  it("可変列幅からドラッグ中の周囲列だけを移動する距離を求める", () => {
    const widths = { count: 120, status: 200, tags: 160 };

    expect(tableColumnDragOffsets(
      ["count", "status", "tags"],
      widths,
      "count",
      "tags",
      "after"
    )).toEqual({ status: -120, tags: -120 });
    expect(tableColumnDragOffsets(
      ["count", "status", "tags"],
      widths,
      "tags",
      "count",
      "before"
    )).toEqual({ count: 160, status: 160 });
    expect(tableColumnDragOffsets(
      ["count", "status", "tags"],
      widths,
      "count",
      "status",
      "before"
    )).toEqual({});
  });

  it("検索と絞り込みをAND条件で適用し、未設定と空値を区別する", () => {
    const targetRows: WorkspaceTableRow[] = [
      ...rows,
      { frontmatterStatus: "invalid", name: "empty", path: "notes/empty.md", properties: { status: { kind: "empty-string", text: "\"\"" } } }
    ];
    expect(filterTableRows(targetRows, "FILE2", [], ["count"]).map((row) => row.path)).toEqual(["file2.md", "a/file2.md"]);
    expect(filterTableRows(targetRows, "", [{ operator: "missing", property: "status", target: "property" }], ["status"])).toHaveLength(4);
    expect(filterTableRows(targetRows, "", [{ operator: "empty", property: "status", target: "property" }], ["status"]).map((row) => row.path)).toEqual(["notes/empty.md"]);
    expect(filterTableRows(targetRows, "", [{ operator: "invalid", target: "frontmatter" }], [])).toEqual([targetRows[4]]);
  });

  it("列幅を範囲内へ制限し、未設定列は既定幅にする", () => {
    const widened = withTableColumnWidth(defaultWorkspaceTablePreferences, "status", 900);
    expect(tableColumnWidth(widened, "status")).toBe(640);
    expect(tableColumnWidth(widened, "count")).toBe(190);
  });
});
