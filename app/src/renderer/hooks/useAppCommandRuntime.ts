import { useMemo, type Dispatch, type SetStateAction } from "react";

import type { ApplicationMenuState } from "../../shared/ipc";
import type { AppCommandActions } from "../appCommandActions";
import type { Translator } from "../i18nModel";
import { useAppKeyboardShortcuts } from "./useAppKeyboardShortcuts";
import { useApplicationMenu } from "./useApplicationMenu";

type PaneId = "left" | "right";

interface UseAppCommandRuntimeInput {
  canReopenClosedTab: boolean;
  closeTabWithMotion: (pane: PaneId, tabId: string) => void;
  focusedPane: PaneId;
  isRightPanelOpen: boolean;
  isSidebarOpen: boolean;
  isSplit: boolean;
  isTypewriterMode: boolean;
  leftActiveTabId: string | null;
  openPanelInPane: (pane: PaneId, panelId: "settings", title: string) => void;
  openQuickSwitcher: () => void;
  reopenClosedTab: () => void;
  rightActiveTabId: string | null;
  setIsCreatingFile: (creating: boolean) => void;
  setShowCommandPalette: Dispatch<SetStateAction<boolean>>;
  setShowQuickSwitcher: Dispatch<SetStateAction<boolean>>;
  setSidebarView: (view: "files") => void;
  t: Translator;
  toggleRightPanel: () => void;
  toggleSidebar: () => void;
  toggleSplit: () => void;
  toggleTypewriterMode: () => void;
}

export function useAppCommandRuntime(input: UseAppCommandRuntimeInput): AppCommandActions {
  const actions = useMemo<AppCommandActions>(() => ({
    "close-tab": () => {
      const activeTabId = input.focusedPane === "left"
        ? input.leftActiveTabId
        : input.rightActiveTabId;
      if (activeTabId) input.closeTabWithMotion(input.focusedPane, activeTabId);
    },
    "new-note": () => {
      input.setSidebarView("files");
      input.setIsCreatingFile(true);
    },
    "open-command-palette": () => {
      input.setShowQuickSwitcher(false);
      input.setShowCommandPalette((current) => !current);
    },
    "open-quick-switcher": () => {
      input.setShowCommandPalette(false);
      input.setShowQuickSwitcher((current) => !current);
    },
    "open-search": input.openQuickSwitcher,
    "open-settings": () => input.openPanelInPane(
      input.focusedPane,
      "settings",
      input.t("nav.settings")
    ),
    "reopen-closed-tab": input.reopenClosedTab,
    "toggle-right-panel": input.toggleRightPanel,
    "toggle-sidebar": input.toggleSidebar,
    "toggle-split": input.toggleSplit,
    "toggle-typewriter": input.toggleTypewriterMode
  }), [
    input.closeTabWithMotion,
    input.focusedPane,
    input.leftActiveTabId,
    input.openPanelInPane,
    input.openQuickSwitcher,
    input.reopenClosedTab,
    input.rightActiveTabId,
    input.setIsCreatingFile,
    input.setShowCommandPalette,
    input.setShowQuickSwitcher,
    input.setSidebarView,
    input.t,
    input.toggleRightPanel,
    input.toggleSidebar,
    input.toggleSplit,
    input.toggleTypewriterMode
  ]);
  const applicationMenuState = useMemo<ApplicationMenuState>(() => ({
    canCloseTab: Boolean(input.focusedPane === "left"
      ? input.leftActiveTabId
      : input.rightActiveTabId),
    canReopenClosedTab: input.canReopenClosedTab,
    canToggleRightPanel: true,
    isRightPanelOpen: input.isRightPanelOpen,
    isSidebarOpen: input.isSidebarOpen,
    isSplit: input.isSplit,
    isTypewriterMode: input.isTypewriterMode
  }), [
    input.canReopenClosedTab,
    input.focusedPane,
    input.isRightPanelOpen,
    input.isSidebarOpen,
    input.isSplit,
    input.isTypewriterMode,
    input.leftActiveTabId,
    input.rightActiveTabId
  ]);

  useApplicationMenu({ actions, state: applicationMenuState });
  useAppKeyboardShortcuts({ actions });
  return actions;
}
