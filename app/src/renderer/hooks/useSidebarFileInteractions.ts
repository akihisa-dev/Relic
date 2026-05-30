import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

import type { MarkdownFileContent } from "../../shared/ipc";
import type { Translator } from "../i18nModel";
import { useEditorStore, type PaneId } from "../store/editorStore";
import type { SidebarCreateFlight } from "./useRailFlights";

interface UseSidebarFileInteractionsInput {
  handleCreateFile: () => void;
  handleCreateFolder: () => void;
  handleOpenFile: (path: string) => void;
  onFileOpenMotion: () => void;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  setWorkspaceError: (message: string | null) => void;
  showSidebarCreateFlight: (flight: SidebarCreateFlight, duration?: number) => void;
  t: Translator;
}

export function useSidebarFileInteractions({
  handleCreateFile,
  handleCreateFolder,
  handleOpenFile,
  onFileOpenMotion,
  openFileInPane,
  setTabActive,
  setWorkspaceError,
  showSidebarCreateFlight,
  t
}: UseSidebarFileInteractionsInput): {
  handleCreateFileFromSidebar: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleCreateFolderFromSidebar: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarOpenFile: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
  openingFilePath: string | null;
} {
  const pendingSidebarFileOpenTokensRef = useRef<Record<string, number>>({});
  const sidebarFileOpenTokenRef = useRef(0);
  const openingFileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openingFilePath, setOpeningFilePath] = useState<string | null>(null);

  const markOpeningFile = useCallback((path: string): void => {
    if (openingFileTimerRef.current) clearTimeout(openingFileTimerRef.current);
    setOpeningFilePath(path);
    openingFileTimerRef.current = setTimeout(() => {
      setOpeningFilePath(null);
      openingFileTimerRef.current = null;
    }, 240);
  }, []);

  useEffect(() => {
    return () => {
      const openingFileTimer = openingFileTimerRef.current;
      if (openingFileTimer) clearTimeout(openingFileTimer);
    };
  }, []);

  const handleSidebarOpenFile = useCallback((path: string, event?: MouseEvent<HTMLButtonElement>): void => {
    if (!event) {
      markOpeningFile(path);
      handleOpenFile(path);
      onFileOpenMotion();
      return;
    }

    const editorState = useEditorStore.getState();
    const targetPane = editorState.focusedPane;
    const paneState = targetPane === "left" ? editorState.leftPane : editorState.rightPane;
    const pendingToken = pendingSidebarFileOpenTokensRef.current[path];

    if (pendingToken) {
      delete pendingSidebarFileOpenTokensRef.current[path];
      setOpeningFilePath(null);
      return;
    }

    const openTabIdInPane = paneState.tabIds.find((tabId) => {
      const tab = editorState.tabs[tabId];
      return tab?.kind === "file" && tab.path === path;
    });
    const openTabInPane = openTabIdInPane ? editorState.tabs[openTabIdInPane] : null;

    if (openTabIdInPane && openTabInPane?.kind === "file") {
      markOpeningFile(path);
      setTabActive(targetPane, openTabIdInPane);
      onFileOpenMotion();
      return;
    }

    const existingTab = Object.values(editorState.tabs).find((tab) => tab.kind === "file" && tab.path === path);
    markOpeningFile(path);

    if (existingTab?.kind === "file") {
      openFileInPane(targetPane, { content: existingTab.content, name: existingTab.name, path: existingTab.path });
      onFileOpenMotion();
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
        onFileOpenMotion();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [handleOpenFile, markOpeningFile, onFileOpenMotion, openFileInPane, setTabActive, setWorkspaceError]);

  const handleCreateFileFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    void event;
    handleCreateFile();
  }, [handleCreateFile]);

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
    handleSidebarOpenFile,
    openingFilePath
  };
}
