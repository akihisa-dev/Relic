import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationMenuState } from "../../shared/ipc";
import { createTranslator } from "../i18nModel";
import { installRelicClientProvider, type RelicClient } from "../relicClient";
import { useAppCommandRuntime } from "./useAppCommandRuntime";

const restores: Array<() => void> = [];

afterEach(() => {
  restores.splice(0).reverse().forEach((restore) => restore());
});

describe("useAppCommandRuntime", () => {
  it("共通コマンドとアプリメニュー状態を一つの境界で構築する", () => {
    const updateApplicationMenuState = vi.fn();
    restores.push(installRelicClientProvider(() => ({
      onApplicationMenuCommand: vi.fn(() => () => undefined),
      updateApplicationMenuState
    } as unknown as RelicClient)));
    const closeTabWithMotion = vi.fn();
    const openPanelInPane = vi.fn();
    const setIsCreatingFile = vi.fn();
    const setShowCommandPalette = vi.fn();
    const setShowQuickSwitcher = vi.fn();
    const setSidebarView = vi.fn();
    const input = {
      canReopenClosedTab: true,
      closeTabWithMotion,
      focusedPane: "right" as const,
      isRightPanelOpen: true,
      isSidebarOpen: false,
      isSplit: true,
      isTypewriterMode: false,
      leftActiveTabId: "left-tab",
      openPanelInPane,
      openQuickSwitcher: vi.fn(),
      reopenClosedTab: vi.fn(),
      rightActiveTabId: "right-tab",
      setIsCreatingFile,
      setShowCommandPalette,
      setShowQuickSwitcher,
      setSidebarView,
      t: createTranslator("ja"),
      toggleRightPanel: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleSplit: vi.fn(),
      toggleTypewriterMode: vi.fn()
    };
    const { result } = renderHook(() => useAppCommandRuntime(input));

    expect(updateApplicationMenuState).toHaveBeenCalledWith({
      canCloseTab: true,
      canReopenClosedTab: true,
      canToggleRightPanel: true,
      isRightPanelOpen: true,
      isSidebarOpen: false,
      isSplit: true,
      isTypewriterMode: false
    } satisfies ApplicationMenuState);
    act(() => result.current["close-tab"]());
    expect(closeTabWithMotion).toHaveBeenCalledWith("right", "right-tab");
    act(() => result.current["new-note"]());
    expect(setSidebarView).toHaveBeenCalledWith("files");
    expect(setIsCreatingFile).toHaveBeenCalledWith(true);
    act(() => result.current["open-command-palette"]());
    expect(setShowQuickSwitcher).toHaveBeenCalledWith(false);
    expect(setShowCommandPalette).toHaveBeenCalledWith(expect.any(Function));
    act(() => result.current["open-settings"]());
    expect(openPanelInPane).toHaveBeenCalledWith("right", "settings", "設定");
  });
});
