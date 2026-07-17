import { relicClient } from "../relicClient";
import { useCallback } from "react";

import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import type { MarkdownFileContent, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { ensureMarkdownExtension } from "../../shared/markdownExtension";
import type { HeadingScrollTarget } from "../editorDerivedState";
import type { PaneId, PanelTabKind, Tab } from "../store/editorStore";
import { joinWorkspacePath } from "../workspacePaths";

interface UseAppPaneFileActionsInput {
  focusedPane: PaneId;
  handleDuplicateTreeFile: (path: string) => void;
  isSplit: boolean;
  openFileInPane: (pane: PaneId, file: MarkdownFileContent) => void;
  openImageInPane: (pane: PaneId, image: { name: string; path: string }) => void;
  openPdfInPane: (pane: PaneId, pdf: { name: string; path: string }) => void;
  openChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  setLeftPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setRightPaneScrollHeading: (heading: HeadingScrollTarget | undefined) => void;
  setWorkspaceError: (message: string | null) => void;
  setWorkspaceState: (state: WorkspaceState) => void;
  tabs: Record<string, Tab>;
}

export function useAppPaneFileActions({
  focusedPane,
  handleDuplicateTreeFile,
  isSplit,
  openFileInPane,
  openImageInPane,
  openPdfInPane,
  openChartInPane,
  openPanelInPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setWorkspaceError,
  setWorkspaceState,
  tabs
}: UseAppPaneFileActionsInput): {
  handleCreateFileInFolder: (folderPath: string, name: string) => void;
  handleCreateFolderInFolder: (folderPath: string, name: string) => void;
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
    } else if (tab.kind === "image") {
      openImageInPane(otherPane, { name: tab.name, path: tab.path });
    } else if (tab.kind === "pdf") {
      openPdfInPane(otherPane, { name: tab.name, path: tab.path });
    } else if (tab.kind === "panel") {
      openPanelInPane(otherPane, tab.panel, tab.name);
    } else {
      openChartInPane(otherPane, { id: tab.chartId, name: tab.name });
    }
  }, [tabs, isSplit, openFileInPane, openImageInPane, openPdfInPane, openChartInPane, openPanelInPane]);

  const openTreeFileInOtherPane = useCallback((path: string): void => {
    if (!relicClient.current || !isSplit) return;
    const otherPane = focusedPane === "left" ? "right" : "left";
    if (isSupportedMarkdownImagePath(path)) {
      openImageInPane(otherPane, { name: path.split("/").at(-1) ?? path, path });
      return;
    }

    if (isSupportedPdfPath(path)) {
      openPdfInPane(otherPane, { name: path.split("/").at(-1) ?? path, path });
      return;
    }

    void relicClient.current.readMarkdownFile({ path }).then((result) => {
      if (result.ok) {
        openFileInPane(otherPane, result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, isSplit, openFileInPane, openImageInPane, openPdfInPane, setWorkspaceError]);

  const openWorkspacePathInOtherPane = useCallback((path: string, heading?: string): void => {
    if (!relicClient.current || !isSplit) return;
    const relic = relicClient.current;
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

  const handleCreateFileInFolder = useCallback((folderPath: string, name: string): void => {
    if (!relicClient.current) return;
    const trimmedFileName = name.trim();
    if (!trimmedFileName) return;

    const nextPath = joinWorkspacePath(folderPath, ensureMarkdownExtension(trimmedFileName));

    setWorkspaceError(null);
    void relicClient.current.createLinkedMarkdownFile({ path: nextPath }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, openFileInPane, setWorkspaceError, setWorkspaceState]);

  const handleCreateFolderInFolder = useCallback((folderPath: string, name: string): void => {
    if (!relicClient.current) return;
    const trimmedFolderName = name.trim();
    if (!trimmedFolderName) return;

    setWorkspaceError(null);
    void relicClient.current.createFolder({ name: trimmedFolderName, parentFolder: folderPath }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError, setWorkspaceState]);

  const handleRevealWorkspaceItem = useCallback((path: string): void => {
    if (!relicClient.current) return;

    setWorkspaceError(null);
    void relicClient.current.revealWorkspaceItem({ path }).then((result) => {
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
