import { useMemo } from "react";

import type { AppCommandActions } from "../appCommandActions";
import type { Command } from "../components/CommandPalette";
import type { TranslationKey } from "../i18nModel";
import { formatShortcut } from "../keyboardShortcuts";
import type { SidebarView } from "../store/uiStore";

type Translate = (key: TranslationKey, params?: Record<string, string>) => string;

interface UseCommandPaletteCommandsInput {
  activeFileName: string | null;
  appCommandActions: AppCommandActions;
  canReopenClosedTab: boolean;
  handleDeleteActiveFile: () => void;
  handleDuplicateActiveFile: () => void;
  setSidebarView: (view: SidebarView) => void;
  t: Translate;
}

export function useCommandPaletteCommands({
  activeFileName,
  appCommandActions,
  canReopenClosedTab,
  handleDeleteActiveFile,
  handleDuplicateActiveFile,
  setSidebarView,
  t
}: UseCommandPaletteCommandsInput): Command[] {
  return useMemo(
    () => [
      {
        id: "new-note",
        label: t("pane.createNote"),
        shortcut: formatShortcut(["mod", "N"]),
        action: appCommandActions["new-note"]
      },
      {
        id: "search",
        label: t("command.search"),
        shortcut: formatShortcut(["mod", "F"]),
        action: appCommandActions["open-search"]
      },
      {
        id: "quick-switcher",
        label: t("command.quickSwitcher"),
        shortcut: formatShortcut(["mod", "P"]),
        action: appCommandActions["open-quick-switcher"]
      },
      {
        id: "toggle-sidebar",
        label: t("command.sidebar"),
        shortcut: formatShortcut(["mod", "B"]),
        action: appCommandActions["toggle-sidebar"]
      },
      {
        id: "toggle-split",
        label: t("command.split"),
        shortcut: formatShortcut(["mod", "\\"]),
        action: appCommandActions["toggle-split"]
      },
      {
        id: "toggle-right-panel",
        label: t("command.rightPanel"),
        shortcut: formatShortcut(["mod", "shift", "B"]),
        action: appCommandActions["toggle-right-panel"]
      },
      ...(canReopenClosedTab
        ? [{
            id: "reopen-closed-tab",
            label: t("command.reopenClosedTab"),
            shortcut: formatShortcut(["mod", "shift", "T"]),
            action: appCommandActions["reopen-closed-tab"]
          }]
        : []),
      {
        id: "toggle-typewriter",
        label: t("command.typewriter"),
        action: appCommandActions["toggle-typewriter"]
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
        action: appCommandActions["open-settings"]
      }
    ],
    [
      activeFileName,
      appCommandActions,
      canReopenClosedTab,
      handleDeleteActiveFile,
      handleDuplicateActiveFile,
      setSidebarView,
      t
    ]
  );
}
