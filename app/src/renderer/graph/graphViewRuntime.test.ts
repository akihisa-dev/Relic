import { beforeEach, describe, expect, it } from "vitest";

import { defaultGraphOptions } from "./graphTypes";
import {
  graphColorGroupsStorageKey,
  loadGraphColorGroups,
  sanitizeGraphOptions
} from "./graphViewRuntime";

describe("graphViewRuntime", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });
  });

  it("保存値を許容範囲へ正規化する", () => {
    expect(sanitizeGraphOptions({
      linkDistance: Number.POSITIVE_INFINITY,
      nodeSizeMultiplier: 99,
      search: "x".repeat(240)
    })).toMatchObject({
      linkDistance: defaultGraphOptions.linkDistance,
      nodeSizeMultiplier: 5,
      search: "x".repeat(200)
    });
  });

  it("不正な色を既定パレットへ置き換えて保存グループを読み込む", () => {
    window.localStorage.setItem(graphColorGroupsStorageKey, JSON.stringify([{
      color: "invalid",
      id: "group-1",
      query: "tag:note"
    }]));

    expect(loadGraphColorGroups()).toEqual([{
      color: "#2f66b1",
      id: "group-1",
      query: "tag:note"
    }]);
  });
});
