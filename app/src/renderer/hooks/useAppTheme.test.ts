import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppTheme } from "../../shared/ipc";
import { useAppTheme } from "./useAppTheme";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("useAppTheme", () => {
  it("reports and follows the effective system theme", () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: true,
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_type: string, nextListener: (event: MediaQueryListEvent) => void) => {
        listener = nextListener;
      },
      removeEventListener: vi.fn()
    })));

    const { result } = renderHook(() => useAppTheme("system"));

    expect(result.current).toBe(true);
    expect(document.documentElement).not.toHaveAttribute("data-theme");

    act(() => listener?.({ matches: false } as MediaQueryListEvent));

    expect(result.current).toBe(false);
  });

  it("reports and applies a fixed theme", () => {
    const { result, rerender } = renderHook(
      ({ theme }: { theme: AppTheme }) => useAppTheme(theme),
      { initialProps: { theme: "light" } }
    );

    expect(result.current).toBe(false);
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    rerender({ theme: "dark" });

    expect(result.current).toBe(true);
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
