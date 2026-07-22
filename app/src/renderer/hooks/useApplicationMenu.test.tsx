import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationMenuCommand, ApplicationMenuState } from "../../shared/ipc";
import type { AppCommandActions } from "../appCommandActions";
import { installRelicClientProvider, type RelicClient } from "../relicClient";
import { useApplicationMenu } from "./useApplicationMenu";

const restores: Array<() => void> = [];

afterEach(() => {
  restores.splice(0).reverse().forEach((restore) => restore());
});

describe("useApplicationMenu", () => {
  it("メニューコマンドを共通アクションへ渡し、状態と購読解除を同期する", () => {
    let listener: ((command: ApplicationMenuCommand) => void) | undefined;
    const unsubscribe = vi.fn();
    const updateApplicationMenuState = vi.fn();
    restores.push(installRelicClientProvider(() => ({
      onApplicationMenuCommand: (callback: (command: ApplicationMenuCommand) => void) => {
        listener = callback;
        return unsubscribe;
      },
      updateApplicationMenuState
    } as unknown as RelicClient)));
    const actions = createActions();
    const state = createState();

    const { rerender, unmount } = renderHook(
      ({ currentState }) => useApplicationMenu({ actions, state: currentState }),
      { initialProps: { currentState: state } }
    );

    expect(updateApplicationMenuState).toHaveBeenCalledWith(state);
    listener?.("open-settings");
    expect(actions["open-settings"]).toHaveBeenCalledOnce();

    const nextState = { ...state, isSidebarOpen: false };
    rerender({ currentState: nextState });
    expect(updateApplicationMenuState).toHaveBeenLastCalledWith(nextState);

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
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

function createState(): ApplicationMenuState {
  return {
    canCloseTab: true,
    canReopenClosedTab: false,
    canToggleRightPanel: true,
    isRightPanelOpen: true,
    isSidebarOpen: true,
    isSplit: false,
    isTypewriterMode: false
  };
}
