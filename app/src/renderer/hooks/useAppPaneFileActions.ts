import { useCallback } from "react";

import type { MarkdownFileContent, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { ensureMarkdownExtension } from "../../shared/markdownExtension";
import type { HeadingScrollTarget } from "../editorDerivedState";
import type { Translator } from "../i18nModel";
import type { PaneId, PanelTabKind, Tab } from "../store/editorStore";
import { joinWorkspacePath } from "../workspacePaths";

interface UseAppPaneFileActionsInput {
  focusedPane: PaneId;
  handleDuplicateTreeFile: (path: string) => void;
  isSplit: boolean;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  openChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  setLeftPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setRightPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  t: Translator;
  tabs: Record<string, Tab>;
}

export function useAppPaneFileActions({
  focusedPane,
  handleDuplicateTreeFile,
  isSplit,
  openFileInPane,
  openChartInPane,
  openPanelInPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setWorkspaceError,
  setWorkspaceState,
  t,
  tabs
}: UseAppPaneFileActionsInput): {
  handleCreateFileInFolder: (folderPath: string) => void;
  handleCreateFolderInFolder: (folderPath: string) => void;
  handleDuplicateTabFile: (tabId: string) => void;
  handleRevealTabFile: (tabId: string) => void;
  handleRevealWorkspaceItem: (path: string) => void;
  handleSelectFolder: (node: Extract<WorkspaceTreeNode, { type: "folder" }>) => void;
  openFileInOtherPane: (fromPane: PaneId, tabId: string) => void;
  openTreeFileInOtherPane: (path: string) => void;
  openWorkspacePathInOtherPane: (path: string, heading?: string) => void;
} {
  const openFileInOtherPane = useCallback((fromPane: PaneId, tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || !isSplit) return;
    const otherPane = fromPane === "left" ? "right" : "left";
    if (tab.kind === "file") {
      openFileInPane(otherPane, { content: tab.content, name: tab.name, path: tab.path });
    } else if (tab.kind === "panel") {
      openPanelInPane(otherPane, tab.panel, tab.name);
    } else {
      openChartInPane(otherPane, { id: tab.chartId, name: tab.name });
    }
  }, [tabs, isSplit, openFileInPane, openChartInPane, openPanelInPane]);

  const openTreeFileInOtherPane = useCallback((path: string): void => {
    if (!window.relic || !isSplit) return;
    const otherPane = focusedPane === "left" ? "right" : "left";

    void window.relic.readMarkdownFile({ path }).then((result) => {
      if (result.ok) {
        openFileInPane(otherPane, result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, isSplit, openFileInPane, setWorkspaceError]);

  const openWorkspacePathInOtherPane = useCallback((path: string, heading?: string): void => {
    if (!window.relic || !isSplit) return;
    const relic = window.relic;
    const otherPane = focusedPane === "left" ? "right" : "left";
    const setScrollHeading = otherPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

    void relic.readMarkdownFile({ path }).then((readResult) => {
      if (readResult.ok) {
        openFileInPane(otherPane, readResult.value);
        if (heading) setScrollHeading(heading);
        return;
      }

      void relic.createLinkedMarkdownFile({ path }).then((createResult) => {
        if (createResult.ok) {
          setWorkspaceState(createResult.value.workspaceState);
          openFileInPane(otherPane, createResult.value.file);
          if (heading) setScrollHeading(heading);
        } else {
          setWorkspaceError(createResult.error.message);
        }
      });
    });
  }, [
    focusedPane,
    isSplit,
    openFileInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState
  ]);

  const handleCreateFileInFolder = useCallback((folderPath: string): void => {
    if (!window.relic) return;
    const fileName = window.prompt(t("files.newNoteName"), t("files.defaultNewNoteName"));
    if (fileName === null) return;
    const trimmedFileName = fileName.trim();
    if (!trimmedFileName) return;

    const nextPath = joinWorkspacePath(folderPath, ensureMarkdownExtension(trimmedFileName));

    setWorkspaceError(null);
    void window.relic.createLinkedMarkdownFile({ path: nextPath }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, openFileInPane, setWorkspaceError, setWorkspaceState, t]);

  const handleCreateFolderInFolder = useCallback((folderPath: string): void => {
    if (!window.relic) return;
    const folderName = window.prompt(t("files.newFolderName"), t("files.defaultNewFolderName"));
    if (folderName === null) return;
    const trimmedFolderName = folderName.trim();
    if (!trimmedFolderName) return;

    setWorkspaceError(null);
    void window.relic.createFolder({ name: trimmedFolderName, parentFolder: folderPath }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError, setWorkspaceState, t]);

  const handleRevealWorkspaceItem = useCallback((path: string): void => {
    if (!window.relic) return;

    setWorkspaceError(null);
    void window.relic.revealWorkspaceItem({ path }).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  const handleDuplicateTabFile = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    handleDuplicateTreeFile(tab.path);
  }, [handleDuplicateTreeFile, tabs]);

  const handleRevealTabFile = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    handleRevealWorkspaceItem(tab.path);
  }, [handleRevealWorkspaceItem, tabs]);

  const handleSelectFolder = useCallback(
    (node: Extract<WorkspaceTreeNode, { type: "folder" }>): void => {
      void node; // 現時点ではフォルダ選択は何もしない
    },
    []
  );

  return {
    handleCreateFileInFolder,
    handleCreateFolderInFolder,
    handleDuplicateTabFile,
    handleRevealTabFile,
    handleRevealWorkspaceItem,
    handleSelectFolder,
    openFileInOtherPane,
    openTreeFileInOtherPane,
    openWorkspacePathInOtherPane
  };
}
