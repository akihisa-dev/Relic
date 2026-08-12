import { relicClient } from "../relicClient";
import { useCallback } from "react";

import { useT } from "../i18n";
import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import type { MarkdownFileContent, WorkspaceState, WorkspaceTreeNode } from "../../shared/ipc";
import { ensureMarkdownExtension } from "../../shared/markdownExtension";
import type { HeadingScrollTarget } from "../editorDerivedState";
import type { PaneId, PanelTabKind, Tab } from "../store/editorStore";
import { joinWorkspacePath } from "../workspacePaths";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

interface UseAppPaneFileActionsInput extends Pick<WorkspaceRequestGuard, "beginWorkspaceRequest"> {
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
  beginWorkspaceRequest,
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
  const t = useT();
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
    const relic = relicClient.current;
    if (!relic || !isSplit) return;
    const otherPane = focusedPane === "left" ? "right" : "left";
    if (isSupportedMarkdownImagePath(path)) {
      openImageInPane(otherPane, { name: path.split("/").at(-1) ?? path, path });
      return;
    }

    if (isSupportedPdfPath(path)) {
      openPdfInPane(otherPane, { name: path.split("/").at(-1) ?? path, path });
      return;
    }

    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    void relic.readMarkdownFile({ path }).then((result) => {
      if (!isCurrentWorkspace()) return;
      if (result.ok) {
        openFileInPane(otherPane, result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    }).catch(() => {
      if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginWorkspaceRequest, focusedPane, isSplit, openFileInPane, openImageInPane, openPdfInPane, setWorkspaceError, t]);

  const openWorkspacePathInOtherPane = useCallback((path: string, heading?: string): void => {
    if (!relicClient.current || !isSplit) return;
    const relic = relicClient.current;
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    const otherPane = focusedPane === "left" ? "right" : "left";
    const setScrollHeading = otherPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

    void relic.readMarkdownFile({ path }).then((readResult) => {
      if (!isCurrentWorkspace()) return;
      if (readResult.ok) {
        openFileInPane(otherPane, readResult.value);
        if (heading) setScrollHeading(heading);
        return;
      }

      void relic.createLinkedMarkdownFile({ path }).then((createResult) => {
        if (!isCurrentWorkspace()) return;
        if (createResult.ok) {
          setWorkspaceState(createResult.value.workspaceState);
          openFileInPane(otherPane, createResult.value.file);
          if (heading) setScrollHeading(heading);
        } else {
          setWorkspaceError(createResult.error.message);
        }
      }).catch(() => {
        if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
      });
    }).catch(() => {
      if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [
    focusedPane,
    beginWorkspaceRequest,
    isSplit,
    openFileInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    t
  ]);

  const handleCreateFileInFolder = useCallback((folderPath: string, name: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const trimmedFileName = name.trim();
    if (!trimmedFileName) return;

    const nextPath = joinWorkspacePath(folderPath, ensureMarkdownExtension(trimmedFileName));

    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    setWorkspaceError(null);
    void relic.createLinkedMarkdownFile({ path: nextPath }).then((result) => {
      if (!isCurrentWorkspace()) return;
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    }).catch(() => {
      if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginWorkspaceRequest, focusedPane, openFileInPane, setWorkspaceError, setWorkspaceState, t]);

  const handleCreateFolderInFolder = useCallback((folderPath: string, name: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const trimmedFolderName = name.trim();
    if (!trimmedFolderName) return;

    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;
    setWorkspaceError(null);
    void relic.createFolder({ name: trimmedFolderName, parentFolder: folderPath }).then((result) => {
      if (!isCurrentWorkspace()) return;
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    }).catch(() => {
      if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginWorkspaceRequest, setWorkspaceError, setWorkspaceState, t]);

  const handleRevealWorkspaceItem = useCallback((path: string): void => {
    const relic = relicClient.current;
    if (!relic) return;
    const isCurrentWorkspace = beginWorkspaceRequest();
    if (!isCurrentWorkspace()) return;

    setWorkspaceError(null);
    void relic.revealWorkspaceItem({ path }).then((result) => {
      if (!isCurrentWorkspace()) return;
      if (!result.ok) setWorkspaceError(result.error.message);
    }).catch(() => {
      if (isCurrentWorkspace()) setWorkspaceError(t("errors.operationFailed"));
    });
  }, [beginWorkspaceRequest, setWorkspaceError, t]);

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
