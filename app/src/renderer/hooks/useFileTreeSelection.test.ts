import { act, renderHook } from "@testing-library/react";
import type { MouseEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceTreeNode } from "../../shared/ipc";
import { useFileTreeSelection } from "./useFileTreeSelection";

const nodes: WorkspaceTreeNode[] = [
  { name: "A", path: "A.md", type: "file" },
  { name: "B", path: "B.md", type: "file" },
  { name: "C", path: "C.md", type: "file" },
  { name: "D", path: "D.md", type: "file" }
];

function mouseEvent(modifiers: {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
} = {}): MouseEvent<HTMLButtonElement> {
  return {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers
  } as MouseEvent<HTMLButtonElement>;
}

describe("useFileTreeSelection", () => {
  it("通常クリックした項目を起点にShiftクリックで範囲選択する", () => {
    const onSelectedCountChange = vi.fn();
    const { result } = renderHook(() => useFileTreeSelection({ nodes, onSelectedCountChange }));

    act(() => {
      const shouldActivate = result.current.handleSelectItem(nodes[0], mouseEvent());
      expect(shouldActivate).toBe(true);
    });

    expect([...result.current.selectedPaths]).toEqual([]);

    act(() => {
      const shouldActivate = result.current.handleSelectItem(nodes[2], mouseEvent({ shiftKey: true }));
      expect(shouldActivate).toBe(false);
    });

    expect([...result.current.selectedPaths]).toEqual(["A.md", "B.md", "C.md"]);
    expect(result.current.selectedItems.map((item) => item.path)).toEqual(["A.md", "B.md", "C.md"]);
  });

  it("Ctrlクリックした項目を起点にShiftクリックで範囲選択する", () => {
    const { result } = renderHook(() => useFileTreeSelection({ nodes }));

    act(() => {
      const shouldActivate = result.current.handleSelectItem(nodes[1], mouseEvent({ ctrlKey: true }));
      expect(shouldActivate).toBe(false);
    });

    expect([...result.current.selectedPaths]).toEqual(["B.md"]);

    act(() => {
      const shouldActivate = result.current.handleSelectItem(nodes[3], mouseEvent({ shiftKey: true }));
      expect(shouldActivate).toBe(false);
    });

    expect([...result.current.selectedPaths]).toEqual(["B.md", "C.md", "D.md"]);
  });
});
