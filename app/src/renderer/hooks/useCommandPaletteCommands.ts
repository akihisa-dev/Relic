import { useMemo } from "react";

import type { Command } from "../components/CommandPalette";
import type { TranslationKey } from "../i18n";

type Translate = (key: TranslationKey, params?: Record<string, string>) => string;

interface UseCommandPaletteCommandsInput {
  activeFileName: string | null;
  handleDeleteActiveFile: () => void;
  handleDuplicateActiveFile: () => void;
  handlePullGitBranch: () => void;
  handlePushGitBranch: () => void;
  setIsCreatingFile: (isCreating: boolean) => void;
  setShowQuickSwitcher: (isShown: boolean) => void;
  setSidebarView: (view: "files" | "search" | "git" | "settings") => void;
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
  handlePullGitBranch,
  handlePushGitBranch,
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
        shortcut: "⌘N",
        action: () => { setSidebarView("files"); setIsCreatingFile(true); }
      },
      {
        id: "search",
        label: t("command.search"),
        shortcut: "⌘F",
        action: () => { setSidebarView("search"); }
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
      {
        id: "git",
        label: t("command.gitView"),
        action: () => { setSidebarView("git"); }
      },
      {
        id: "git-push",
        label: t("command.gitPush"),
        action: () => { setSidebarView("git"); handlePushGitBranch(); }
      },
      {
        id: "git-pull",
        label: t("command.gitPull"),
        action: () => { setSidebarView("git"); handlePullGitBranch(); }
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
      handlePullGitBranch,
      handlePushGitBranch,
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
