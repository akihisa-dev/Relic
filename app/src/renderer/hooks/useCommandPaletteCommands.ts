import { useMemo } from "react";

import type { Command } from "../components/CommandPalette";
import type { TranslationKey } from "../i18n";

type Translate = (key: TranslationKey, params?: Record<string, string>) => string;

interface UseCommandPaletteCommandsInput {
  activeCardName: string | null;
  handleDeleteActiveCard: () => void;
  handleDuplicateActiveCard: () => void;
  requestCardSearchFocus: () => void;
  setIsCreatingCard: (isCreating: boolean) => void;
  setShowQuickSwitcher: (isShown: boolean) => void;
  setSidebarView: (view: "cards" | "settings") => void;
  t: Translate;
  toggleRightPanel: () => void;
  toggleSidebar: () => void;
  toggleSplit: () => void;
  toggleTypewriterMode: () => void;
}

export function useCommandPaletteCommands({
  activeCardName,
  handleDeleteActiveCard,
  handleDuplicateActiveCard,
  requestCardSearchFocus,
  setIsCreatingCard,
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
        shortcut: "⌘N",
        action: () => { setSidebarView("cards"); setIsCreatingCard(true); }
      },
      {
        id: "search",
        label: t("command.search"),
        shortcut: "⌘F",
        action: requestCardSearchFocus
      },
      {
        id: "quick-switcher",
        label: t("command.quickSwitcher"),
        shortcut: "⌘P",
        action: () => setShowQuickSwitcher(true)
      },
      {
        id: "toggle-sidebar",
        label: t("command.sidebar"),
        shortcut: "⌘B",
        action: toggleSidebar
      },
      {
        id: "toggle-split",
        label: t("command.split"),
        shortcut: "⌘\\",
        action: toggleSplit
      },
      {
        id: "toggle-right-panel",
        label: t("command.rightPanel"),
        shortcut: "⌘⇧B",
        action: toggleRightPanel
      },
      {
        id: "toggle-typewriter",
        label: t("command.typewriter"),
        shortcut: "⌘⇧T",
        action: toggleTypewriterMode
      },
      ...(activeCardName
        ? [
            {
              id: "rename-card",
              label: t("command.renameCard", { name: activeCardName }),
              action: () => {
                setSidebarView("cards");
              }
            },
            {
              id: "duplicate-card",
              label: t("command.duplicateCard", { name: activeCardName }),
              action: handleDuplicateActiveCard
            },
            {
              id: "delete-card",
              label: t("command.deleteCard", { name: activeCardName }),
              action: handleDeleteActiveCard
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
      activeCardName,
      handleDeleteActiveCard,
      handleDuplicateActiveCard,
      requestCardSearchFocus,
      setIsCreatingCard,
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
