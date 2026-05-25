import { describe, expect, it } from "vitest";

import {
  canMoveHorizontallyWithArrow,
  clearSelectedRange,
  parsePastedTableCells,
  selectedRangeFromDataset,
  selectedRangeText,
  withPastedTableCells
} from "./editorTableWidgetModel";

describe("editorTableWidgetModel", () => {
  it("TSV貼り付けを表セル配列として読む", () => {
    expect(parsePastedTableCells("a\tb\nc\td\n")).toEqual([
      ["a", "b"],
      ["c", "d"]
    ]);
    expect(parsePastedTableCells("single")).toBeNull();
  });

  it("貼り付け範囲が既存行列を超える場合も表へ展開する", () => {
    expect(withPastedTableCells([
      ["A", "B"],
      ["1", "2"]
    ], 1, 1, [
      ["x", "y"],
      ["z", "w"]
    ])).toEqual([
      ["A", "B"],
      ["1", "x", "y"],
      ["", "z", "w"]
    ]);
  });

  it("選択範囲datasetを読み、TSVコピー文字列を作る", () => {
    const range = selectedRangeFromDataset("1:0:2:1");

    expect(range).toEqual({ fromCol: 0, fromRow: 1, toCol: 1, toRow: 2 });
    expect(selectedRangeText([
      ["A", "B"],
      ["1", "2"],
      ["3"]
    ], range!)).toBe("1\t2\n3\t");
    expect(selectedRangeFromDataset("1:x:2:1")).toBeNull();
  });

  it("選択範囲のセル内容だけを空にする", () => {
    expect(clearSelectedRange([
      ["A", "B", "C"],
      ["1", "2", "3"],
      ["4", "5", "6"]
    ], { fromCol: 1, fromRow: 1, toCol: 2, toRow: 2 })).toEqual([
      ["A", "B", "C"],
      ["1", "", ""],
      ["4", "", ""]
    ]);
  });

  it("左右矢印はセル内カーソルが端にある場合だけ移動対象にする", () => {
    expect(canMoveHorizontallyWithArrow({
      key: "ArrowLeft",
      selectionEnd: 0,
      selectionStart: 0,
      value: "text"
    })).toBe(true);
    expect(canMoveHorizontallyWithArrow({
      key: "ArrowRight",
      selectionEnd: 4,
      selectionStart: 4,
      value: "text"
    })).toBe(true);
    expect(canMoveHorizontallyWithArrow({
      key: "ArrowRight",
      selectionEnd: 2,
      selectionStart: 2,
      value: "text"
    })).toBe(false);
    expect(canMoveHorizontallyWithArrow({
      key: "ArrowLeft",
      selectionEnd: 2,
      selectionStart: 0,
      value: "text"
    })).toBe(false);
  });
});
