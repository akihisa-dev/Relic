import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AppCommandActions } from "../appCommandActions";
import { useAppKeyboardShortcuts } from "./useAppKeyboardShortcuts";

describe("useAppKeyboardShortcuts", () => {
  it("Command+Wだけをタブ終了に使い、Command+Shift+Wはウインドウメニューへ残す", () => {
    const actions = createActions();
    const { unmount } = renderHook(() => useAppKeyboardShortcuts({ actions }));

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", metaKey: true, shiftKey: true }));
    expect(actions["close-tab"]).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", metaKey: true }));
    expect(actions["close-tab"]).toHaveBeenCalledOnce();
    unmount();
  });
});

function createActions(): AppCommandActions {
  return Object.fromEntries([
    "close-tab",
    "new-note",
    "open-command-palette",
    "open-quick-switcher",
    "open-search",
    "open-settings",
    "reopen-closed-tab",
    "toggle-right-panel",
    "toggle-sidebar",
    "toggle-split",
    "toggle-typewriter"
  ].map((command) => [command, vi.fn()])) as unknown as AppCommandActions;
}
