import { describe, expect, it, vi } from "vitest";

import {
  liveTableAxisIndexFromPoint,
  measureLiveTableAxisSegment
} from "./editorTableWidgetGeometry";
import { createLiveTableDragController } from "./editorTableWidgetDrag";
import { createLiveTableInteractionState } from "./editorTableWidgetState";

function rect({ height, left, top, width }: { height: number; left: number; top: number; width: number }): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

function createMeasuredTable(): { table: HTMLTableElement; wrapper: HTMLDivElement } {
  const wrapper = document.createElement("div");
  const table = document.createElement("table");
  wrapper.append(table);
  [
    { height: 36, top: 120 },
    { height: 52, top: 156 },
    { height: 104, top: 208 }
  ].forEach(({ height, top }) => {
    const row = table.insertRow();
    [0, 1].forEach((column) => {
      const cell = row.insertCell();
      vi.spyOn(cell, "getBoundingClientRect").mockReturnValue(rect({
        height,
        left: 80 + column * 160,
        top,
        width: 160
      }));
    });
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue(rect({ height, left: 80, top, width: 320 }));
  });
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(rect({ height: 192, left: 80, top: 120, width: 320 }));
  vi.spyOn(table, "getBoundingClientRect").mockReturnValue(rect({ height: 192, left: 80, top: 120, width: 320 }));
  return { table, wrapper };
}

describe("editorTableWidgetGeometry", () => {
  it("折り返しで高さが異なる行の実際の位置と高さを返す", () => {
    const { table, wrapper } = createMeasuredTable();

    expect(measureLiveTableAxisSegment(wrapper, table, "row", 2)).toEqual({
      size: 104,
      start: 88
    });
  });

  it("表の外側にある行ハンドル上でも実際の行境界から対象行を判定する", () => {
    const { table } = createMeasuredTable();

    expect(liveTableAxisIndexFromPoint(table, "row", 180, 1)).toBe(1);
    expect(liveTableAxisIndexFromPoint(table, "row", 260, 1)).toBe(2);
  });

  it("行選択表示とハンドルを高さの異なる対象行へ合わせる", () => {
    const { table, wrapper } = createMeasuredTable();
    const state = createLiveTableInteractionState(wrapper, table, 3, 2);

    state.markActive("row", 2, 0);

    expect(wrapper.style.getPropertyValue("--table-active-row-start")).toBe("88px");
    expect(wrapper.style.getPropertyValue("--table-active-row-center")).toBe("140px");
    expect(wrapper.style.getPropertyValue("--table-active-row-height")).toBe("104px");
  });

  it("行ドラッグの移動先表示を実際の行上端へ合わせる", () => {
    const { table, wrapper } = createMeasuredTable();
    const onMove = vi.fn();
    const drag = createLiveTableDragController({
      colCount: 2,
      getActiveCol: () => 0,
      getActiveRow: () => 2,
      onMove,
      rowCount: 3,
      table,
      wrapper
    });

    drag.beginCoordinateDrag("row", new MouseEvent("mousedown", { clientX: 60, clientY: 260 }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 60, clientY: 180 }));

    expect(wrapper.style.getPropertyValue("--table-drop-row")).toBe("36px");

    document.dispatchEvent(new MouseEvent("mouseup", { clientX: 60, clientY: 180 }));
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ axis: "row", sourceRow: 2, targetRow: 1 }));
    expect(wrapper.dataset.dragAxis).toBeUndefined();
  });
});
