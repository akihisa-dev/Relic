import { useMemo } from "react";

import type { Command } from "../components/CommandPalette";
import type { TranslationKey } from "../i18nModel";
import { formatShortcut } from "../keyboardShortcuts";

type Translate = (key: TranslationKey, params?: Record<string, string>) => string;

interface UseCommandPaletteCommandsInput {
  activeFileName: string | null;
  handleDeleteActiveFile: () => void;
  handleDuplicateActiveFile: () => void;
  requestFileSearchFocus: () => void;
  setIsCreatingFile: (isCreating: boolean) => void;
  setShowQuickSwitcher: (isShown: boolean) => void;
  setSidebarView: (view: "files" | "settings") => void;
  t: Translate;
  toggleRightPanel: () => void;
  toggleSidebar: () => void;
  toggleSplit: () => void;
  toggleTypewriterMode: () => void;
}

export function useCommandPaletteCommands({
  activeFileName,
  handleDeleteActiveFile,
  handleDuplicateActiveFile,
  requestFileSearchFocus,
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
      {
        id: "toggle-typewriter",
        label: t("command.typewriter"),
        shortcut: formatShortcut(["mod", "shift", "T"]),
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
      handleDeleteActiveFile,
      handleDuplicateActiveFile,
      requestFileSearchFocus,
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
