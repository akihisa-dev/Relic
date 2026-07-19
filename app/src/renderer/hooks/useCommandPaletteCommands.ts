import { useMemo } from "react";

import type { Command } from "../components/CommandPalette";
import type { TranslationKey } from "../i18nModel";
import { formatShortcut } from "../keyboardShortcuts";
import type { SidebarView } from "../store/uiStore";

type Translate = (key: TranslationKey, params?: Record<string, string>) => string;

interface UseCommandPaletteCommandsInput {
  activeFileName: string | null;
  canReopenClosedTab: boolean;
  handleDeleteActiveFile: () => void;
  handleDuplicateActiveFile: () => void;
  requestFileSearchFocus: () => void;
  reopenClosedTab: () => void;
  setIsCreatingFile: (isCreating: boolean) => void;
  setShowQuickSwitcher: (isShown: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  t: Translate;
  toggleRightPanel: () => void;
  toggleSidebar: () => void;
  toggleSplit: () => void;
  toggleTypewriterMode: () => void;
}

export function useCommandPaletteCommands({
  activeFileName,
  canReopenClosedTab,
  handleDeleteActiveFile,
  handleDuplicateActiveFile,
  requestFileSearchFocus,
  reopenClosedTab,
  setIsCreatingFile,
  setShowQuickSwitcher,
  setSidebarView,
  t,
  toggleRightPanel,
  toggleSidebar,
  toggleSplit,
  toggleTypewriterMode
}: UseCommandPaletteCommandsInput): Command[] {
  return useMemo(
    () => [
      {
        id: "new-note",
        label: t("pane.createNote"),
        shortcut: formatShortcut(["mod", "N"]),
        action: () => { setSidebarView("files"); setIsCreatingFile(true); }
      },
      {
        id: "search",
        label: t("command.search"),
        shortcut: formatShortcut(["mod", "F"]),
        action: requestFileSearchFocus
      },
      {
        id: "quick-switcher",
        label: t("command.quickSwitcher"),
        shortcut: formatShortcut(["mod", "P"]),
        action: () => setShowQuickSwitcher(true)
      },
      {
        id: "toggle-sidebar",
        label: t("command.sidebar"),
        shortcut: formatShortcut(["mod", "B"]),
        action: toggleSidebar
      },
      {
        id: "toggle-split",
        label: t("command.split"),
        shortcut: formatShortcut(["mod", "\\"]),
        action: toggleSplit
      },
      {
        id: "toggle-right-panel",
        label: t("command.rightPanel"),
        shortcut: formatShortcut(["mod", "shift", "B"]),
        action: toggleRightPanel
      },
      ...(canReopenClosedTab
        ? [{
            id: "reopen-closed-tab",
            label: t("command.reopenClosedTab"),
            shortcut: formatShortcut(["mod", "shift", "T"]),
            action: reopenClosedTab
          }]
        : []),
      {
        id: "toggle-typewriter",
        label: t("command.typewriter"),
        action: toggleTypewriterMode
      },
      ...(activeFileName
        ? [
            {
              id: "rename-file",
              label: t("command.renameFile", { name: activeFileName }),
              action: () => {
                setSidebarView("files");
              }
            },
            {
              id: "duplicate-file",
              label: t("command.duplicateFile", { name: activeFileName }),
              action: handleDuplicateActiveFile
            },
            {
              id: "delete-file",
              label: t("command.deleteFile", { name: activeFileName }),
              action: handleDeleteActiveFile
            }
          ]
        : []),
      {
        id: "settings",
        label: t("command.settings"),
        action: () => { setSidebarView("settings"); }
      }
    ],
    [
      activeFileName,
      canReopenClosedTab,
      handleDeleteActiveFile,
      handleDuplicateActiveFile,
      requestFileSearchFocus,
      reopenClosedTab,
      setIsCreatingFile,
      setShowQuickSwitcher,
      setSidebarView,
      t,
      toggleRightPanel,
      toggleSidebar,
      toggleSplit,
      toggleTypewriterMode
    ]
  );
}
