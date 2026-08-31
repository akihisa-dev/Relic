import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStableCallback, useStableOptionalCallback } from "./useStableCallback";

describe("useStableCallback", () => {
  it("関数の同一性を保ったまま最新renderの処理へ渡す", () => {
    const { rerender, result } = renderHook(
      ({ prefix }) => useStableCallback((value: string) => `${prefix}:${value}`),
      { initialProps: { prefix: "first" } }
    );
    const firstCallback = result.current;

    rerender({ prefix: "second" });

    expect(result.current).toBe(firstCallback);
    expect(result.current("value")).toBe("second:value");
  });

  it("任意の関数は有無を保ち、存在中は同一性と最新処理を両立する", () => {
    const { rerender, result } = renderHook(
      ({ enabled, prefix }) => useStableOptionalCallback(
        enabled ? (value: string) => `${prefix}:${value}` : undefined
      ),
      { initialProps: { enabled: true, prefix: "first" } }
    );
    const firstCallback = result.current;

    rerender({ enabled: true, prefix: "second" });
    expect(result.current).toBe(firstCallback);
    expect(result.current?.("value")).toBe("second:value");

    rerender({ enabled: false, prefix: "third" });
    expect(result.current).toBeUndefined();

    rerender({ enabled: true, prefix: "fourth" });
    expect(result.current).toBe(firstCallback);
    expect(result.current?.("value")).toBe("fourth:value");
  });
});
