import { useEffect } from "react";

import type { PaneId, PaneState } from "../store/editorStore";

interface UseAppKeyboardShortcutsInput {
  closeTab: (pane: PaneId, tabId: string) => void;
  focusedPane: PaneId;
  leftPane: PaneState;
  requestCardSearchFocus: () => void;
  rightPane: PaneState;
  setIsCreatingCard: (isCreating: boolean) => void;
  setShowCommandPalette: (updater: boolean | ((current: boolean) => boolean)) => void;
  setShowQuickSwitcher: (updater: boolean | ((current: boolean) => boolean)) => void;
  setSidebarView: (view: "cards") => void;
  toggleRightPanel: () => void;
  toggleSidebar: () => void;
  toggleSplit: () => void;
  toggleTypewriterMode: () => void;
}

export function useAppKeyboardShortcuts({
  closeTab,
  focusedPane,
  leftPane,
  requestCardSearchFocus,
  rightPane,
  setIsCreatingCard,
  setShowCommandPalette,
  setShowQuickSwitcher,
  setSidebarView,
  toggleRightPanel,
  toggleSidebar,
  toggleSplit,
  toggleTypewriterMode
}: UseAppKeyboardShortcutsInput): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (!event.metaKey) return;

      if (event.shiftKey && event.key === "P") {
        event.preventDefault();
        setShowQuickSwitcher(false);
        setShowCommandPalette((current) => !current);
      } else if (!event.shiftKey && event.key === "p") {
        event.preventDefault();
        setShowCommandPalette(false);
        setShowQuickSwitcher((current) => !current);
      } else if (event.key === "b" && !event.shiftKey) {
        event.preventDefault();
        toggleSidebar();
      } else if (event.key === "\\") {
        event.preventDefault();
        toggleSplit();
      } else if (event.key === "b" && event.shiftKey) {
        event.preventDefault();
        toggleRightPanel();
      } else if (event.key === "w") {
        event.preventDefault();
        const paneState = focusedPane === "left" ? leftPane : rightPane;
        if (paneState.activeTabId) closeTab(focusedPane, paneState.activeTabId);
      } else if (event.key === "f") {
        event.preventDefault();
        requestCardSearchFocus();
      } else if (event.key === "n" && !event.shiftKey) {
        event.preventDefault();
        setSidebarView("cards");
        setIsCreatingCard(true);
      } else if (event.key === "T" && event.shiftKey) {
        event.preventDefault();
        toggleTypewriterMode();
      }
    };

    window.addEventListener("keydown", handler, true);

    return () => window.removeEventListener("keydown", handler, true);
  }, [
    closeTab,
    focusedPane,
    leftPane,
    requestCardSearchFocus,
    rightPane,
    setIsCreatingCard,
    setShowCommandPalette,
    setShowQuickSwitcher,
    setSidebarView,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit,
    toggleTypewriterMode
  ]);
}
