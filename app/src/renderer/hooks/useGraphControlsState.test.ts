import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  graphColorGroupsStorageKey,
  graphControlsStorageKey,
  graphOptionsStorageKey,
  graphSectionCollapsedStorageKey
} from "../graph/graphViewRuntime";
import { useGraphControlsState } from "./useGraphControlsState";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useGraphControlsState", () => {
  it("設定操作を一つの状態境界で更新して保存する", () => {
    vi.spyOn(Date, "now").mockReturnValue(123);
    const { result } = renderHook(() => useGraphControlsState());

    act(() => {
      result.current.addColorGroup();
      result.current.changeOptions({ showTags: true });
      result.current.changeSectionCollapsed("filter", false);
      result.current.toggleControls();
    });

    expect(result.current.colorGroups).toEqual([{
      color: "#f2691b",
      id: "group-123-0",
      query: ""
    }]);
    expect(result.current.options.showTags).toBe(true);
    expect(result.current.sectionCollapsed.filter).toBe(false);
    expect(result.current.controlsOpen).toBe(false);
    expect(JSON.parse(window.localStorage.getItem(graphColorGroupsStorageKey) ?? "null")).toEqual(result.current.colorGroups);
    expect(JSON.parse(window.localStorage.getItem(graphOptionsStorageKey) ?? "null")).toMatchObject({ showTags: true });
    expect(JSON.parse(window.localStorage.getItem(graphSectionCollapsedStorageKey) ?? "null")).toMatchObject({ filter: false });
    expect(JSON.parse(window.localStorage.getItem(graphControlsStorageKey) ?? "null")).toBe(false);
  });

  it("色グループの並べ替えと設定リセットを同じ境界で扱う", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(200);
    const { result } = renderHook(() => useGraphControlsState());

    act(() => {
      result.current.addColorGroup();
    });
    act(() => {
      result.current.addColorGroup();
    });
    act(() => {
      result.current.startColorGroupDrag("group-200-1");
    });
    act(() => {
      result.current.moveColorGroup("group-100-0");
      result.current.endColorGroupDrag();
      result.current.changeOptions({ search: "tag:note" });
    });

    expect(result.current.colorGroups.map((group) => group.id)).toEqual(["group-200-1", "group-100-0"]);

    act(() => {
      result.current.resetControls();
    });

    expect(result.current.colorGroups).toEqual([]);
    expect(result.current.options.search).toBe("");
  });
});
