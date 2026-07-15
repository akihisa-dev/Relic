import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultGraphOptions } from "./graphTypes";
import {
  graphColorGroupsStorageKey,
  loadGraphColorGroups,
  readGraphDrawTheme,
  requestGraphFrameOnce,
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
      color: "#f2691b",
      id: "group-1",
      query: "tag:note"
    }]);
  });

  it("描画用のCSS変数を1回のスタイル取得で読み込む", () => {
    const getPropertyValue = vi.fn((name: string) => ({
      "--color-accent": " #111111 ",
      "--color-bg": "#101010",
      "--color-border": "#222222",
      "--color-border-strong": "#333333",
      "--color-primary": "#444444",
      "--color-text": "#555555",
      "--color-text-muted": "#666666",
      "--color-text-secondary": "#777777"
    })[name] ?? "");
    const computedStyle = vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue
    } as unknown as CSSStyleDeclaration);
    const canvas = document.createElement("canvas");

    expect(readGraphDrawTheme(canvas)).toEqual({
      accent: "#111111",
      background: "#101010",
      border: "#222222",
      borderStrong: "#333333",
      primary: "#444444",
      text: "#555555",
      textMuted: "#666666",
      textSecondary: "#777777"
    });
    expect(computedStyle).toHaveBeenCalledOnce();
    expect(computedStyle).toHaveBeenCalledWith(canvas);
    expect(getPropertyValue).toHaveBeenCalledTimes(8);
  });

  it("描画フレームを重複予約せず、実行後は再予約できる", () => {
    const scheduled: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduled.push(callback);
      return 42;
    });
    const frameRef = { current: null as number | null };
    const callback = vi.fn();

    requestGraphFrameOnce(frameRef, callback);
    requestGraphFrameOnce(frameRef, callback);
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
    expect(frameRef.current).toBe(42);

    scheduled[0]?.(16);
    expect(callback).toHaveBeenCalledWith(16);
    expect(frameRef.current).toBeNull();

    requestGraphFrameOnce(frameRef, callback);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });
});
