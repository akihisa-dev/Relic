import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import {
  deleteTableColumn,
  deleteTableRow,
  findTableBlocks,
  formatTable,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableColumnTo,
  moveTableRow,
  moveTableRowTo,
  sortTableByColumn,
  withTableCellValue
} from "./editorTableModel";

describe("editorTableModel", () => {
  it("Markdown本文からテーブルブロックを検出する", () => {
    const state = EditorState.create({
      doc: [
        "# Note",
        "",
        "| Name | Count |",
        "| --- | --- |",
        "| b | 2 |",
        "| a | 10 |",
        "",
        "after"
      ].join("\n")
    });

    expect(findTableBlocks(state)).toEqual([{
      from: 8,
      rows: [
        ["Name", "Count"],
        ["b", "2"],
        ["a", "10"]
      ],
      to: 59
    }]);
  });

  it("列数を正規化してMarkdownテーブルを書き戻す", () => {
    expect(formatTable([
      ["A"],
      ["1", "2"],
      ["3"]
    ])).toBe([
      "| A |  |",
      "| --- | --- |",
      "| 1 | 2 |",
      "| 3 |  |"
    ].join("\n"));
  });

  it("セル、行、列を追加・削除できる", () => {
    const rows = [
      ["A", "B"],
      ["1", "2"]
    ];

    expect(withTableCellValue(rows, 1, 1, "updated")).toEqual([
      ["A", "B"],
      ["1", "updated"]
    ]);
    expect(insertTableRow(rows, 1)).toEqual([
      ["A", "B"],
      ["", ""],
      ["1", "2"]
    ]);
    expect(deleteTableRow(rows, 1)).toEqual([["A", "B"]]);
    expect(insertTableColumn(rows, 1)).toEqual([
      ["A", "", "B"],
      ["1", "", "2"]
    ]);
    expect(deleteTableColumn(rows, 0)).toEqual([
      ["B"],
      ["2"]
    ]);
  });

  it("行列の移動と列ソートができる", () => {
    const rows = [
      ["Name", "Count"],
      ["b", "2"],
      ["a", "10"],
      ["c", "1"]
    ];

    expect(moveTableRow(rows, 2, -1)).toEqual([
      ["Name", "Count"],
      ["a", "10"],
      ["b", "2"],
      ["c", "1"]
    ]);
    expect(moveTableRowTo(rows, 3, 1)).toEqual([
      ["Name", "Count"],
      ["c", "1"],
      ["b", "2"],
      ["a", "10"]
    ]);
    expect(moveTableColumn(rows, 1, -1)).toEqual([
      ["Count", "Name"],
      ["2", "b"],
      ["10", "a"],
      ["1", "c"]
    ]);
    expect(moveTableColumnTo(rows, 0, 1)).toEqual([
      ["Count", "Name"],
      ["2", "b"],
      ["10", "a"],
      ["1", "c"]
    ]);
    expect(sortTableByColumn(rows, 1, "asc")).toEqual([
      ["Name", "Count"],
      ["c", "1"],
      ["b", "2"],
      ["a", "10"]
    ]);
  });

  it("無効な行列操作は元の内容を保つ", () => {
    const rows = [
      ["A", "B"],
      ["1", "2"]
    ];

    expect(deleteTableRow(rows, 5)).toEqual(rows);
    expect(deleteTableColumn(rows, -1)).toEqual(rows);
    expect(moveTableRow(rows, 0, 1)).toEqual(rows);
    expect(moveTableRowTo(rows, 1, 0)).toEqual(rows);
    expect(moveTableColumn(rows, 0, -1)).toEqual(rows);
    expect(moveTableColumnTo(rows, 0, 3)).toEqual(rows);
  });
});
