import { useCallback, useRef } from "react";
import type { MouseEvent } from "react";

import type { MarkdownFileContent } from "../../shared/ipc";
import type { Translator } from "../i18n";
import { useEditorStore, type PaneId } from "../store/editorStore";
import { displayNameFromPath } from "../workspacePaths";
import type { RailTabFlight, SidebarCreateFlight } from "./useRailFlights";

interface UseSidebarFileInteractionsInput {
  focusedPane: PaneId;
  handleCreateFile: () => void;
  handleCreateFolder: () => void;
  handleOpenFile: (path: string) => void;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  setWorkspaceError: (message: string | null) => void;
  showRailTabFlight: (flight: RailTabFlight, duration?: number) => void;
  showSidebarCreateFlight: (flight: SidebarCreateFlight, duration?: number) => void;
  t: Translator;
}

export function useSidebarFileInteractions({
  focusedPane,
  handleCreateFile,
  handleCreateFolder,
  handleOpenFile,
  openFileInPane,
  setTabActive,
  setWorkspaceError,
  showRailTabFlight,
  showSidebarCreateFlight,
  t
}: UseSidebarFileInteractionsInput): {
  handleCreateFileFromSidebar: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleCreateFolderFromSidebar: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarOpenFile: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
} {
  const pendingSidebarFileOpenTokensRef = useRef<Record<string, number>>({});
  const sidebarFileOpenTokenRef = useRef(0);

  const handleSidebarOpenFile = useCallback((path: string, event?: MouseEvent<HTMLButtonElement>): void => {
    if (!event) {
      handleOpenFile(path);
      return;
    }

    const rowRect = event.currentTarget.getBoundingClientRect();
    const editorState = useEditorStore.getState();
    const targetPane = editorState.focusedPane;
    const paneState = targetPane === "left" ? editorState.leftPane : editorState.rightPane;
    const tabBar = document.querySelector(`.pane${targetPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
    const tabBarRect = tabBar?.getBoundingClientRect();
    const pendingToken = pendingSidebarFileOpenTokensRef.current[path];

    if (pendingToken) {
      delete pendingSidebarFileOpenTokensRef.current[path];
      showRailTabFlight({
        direction: "close",
        fromX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
        fromY: (tabBarRect?.top ?? rowRect.top) + 15,
        label: displayNameFromPath(path),
        toX: rowRect.left + rowRect.width / 2,
        toY: rowRect.top + rowRect.height / 2
      });
      return;
    }

    const openTabIdInPane = paneState.tabIds.find((tabId) => {
      const tab = editorState.tabs[tabId];
      return tab?.kind === "file" && tab.path === path;
    });
    const openTabInPane = openTabIdInPane ? editorState.tabs[openTabIdInPane] : null;

    if (openTabIdInPane && openTabInPane?.kind === "file") {
      setTabActive(targetPane, openTabIdInPane);
      return;
    }

    const existingTab = Object.values(editorState.tabs).find((tab) => tab.kind === "file" && tab.path === path);
    const label = existingTab?.name ?? displayNameFromPath(path);

    showRailTabFlight({
      direction: "open",
      fromX: rowRect.left + rowRect.width / 2,
      fromY: rowRect.top + rowRect.height / 2,
      label,
      toX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
      toY: (tabBarRect?.top ?? rowRect.top) + 15
    });

    if (existingTab?.kind === "file") {
      openFileInPane(targetPane, { content: existingTab.content, name: existingTab.name, path: existingTab.path });
      return;
    }

    if (!window.relic) return;

    setWorkspaceError(null);
    const token = sidebarFileOpenTokenRef.current + 1;
    sidebarFileOpenTokenRef.current = token;
    pendingSidebarFileOpenTokensRef.current[path] = token;
    void window.relic.readMarkdownFile({ path }).then((result) => {
      if (pendingSidebarFileOpenTokensRef.current[path] !== token) return;
      delete pendingSidebarFileOpenTokensRef.current[path];
      if (result.ok) {
        openFileInPane(targetPane, result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [handleOpenFile, openFileInPane, setTabActive, setWorkspaceError, showRailTabFlight]);

  const handleCreateFileFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tabBar = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const tabBarRect = tabBar?.getBoundingClientRect();

      showRailTabFlight({
        direction: "open",
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("files.createNote"),
        toX: (tabBarRect?.left ?? buttonRect.left + buttonRect.width + 120) + 48,
        toY: (tabBarRect?.top ?? buttonRect.top) + 15
      });
    }

    handleCreateFile();
  }, [focusedPane, handleCreateFile, showRailTabFlight, t]);

  const handleCreateFolderFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tree = document.querySelector(".sidebar-view-content--files .file-tree");
      const treeRect = tree?.getBoundingClientRect();

      showSidebarCreateFlight({
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("files.createFolder"),
        toX: (treeRect?.left ?? buttonRect.left) + 24,
        toY: (treeRect?.top ?? buttonRect.top + 72) + 14
      });
    }

    handleCreateFolder();
  }, [handleCreateFolder, showSidebarCreateFlight, t]);

  return {
    handleCreateFileFromSidebar,
    handleCreateFolderFromSidebar,
    handleSidebarOpenFile
  };
}
