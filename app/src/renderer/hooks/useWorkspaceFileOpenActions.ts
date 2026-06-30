import { useCallback } from "react";

import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { resolveMarkdownLinkPath, resolveWikiLinkPathWithAliases } from "../../shared/links";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";

type WorkspaceFileOpenInput = Pick<
  WorkspaceFileActionsContext,
  | "aliasesByPath"
  | "closeTab"
  | "existingMarkdownPaths"
  | "focusedPane"
  | "leftPane"
  | "openFileInPane"
  | "openImageInPane"
  | "openPdfInPane"
  | "rightPane"
  | "setLeftPaneScrollHeading"
  | "setRightPaneScrollHeading"
  | "setWorkspaceError"
  | "setWorkspaceState"
  | "tabs"
>;

export function useWorkspaceFileOpenActions({
  aliasesByPath,
  closeTab,
  existingMarkdownPaths,
  focusedPane,
  leftPane,
  openFileInPane,
  openImageInPane,
  openPdfInPane,
  rightPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setWorkspaceError,
  setWorkspaceState,
  tabs
}: WorkspaceFileOpenInput) {
  const handleOpenFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTabId = paneState.activeTabId;
      const activeTab = activeTabId ? tabs[activeTabId] : null;

      if (
        activeTabId &&
        (activeTab?.kind === "file" || activeTab?.kind === "image" || activeTab?.kind === "pdf") &&
        activeTab.path === path
      ) {
        closeTab(focusedPane, activeTabId);
        return;
      }

      if (isSupportedMarkdownImagePath(path)) {
        openImageInPane(focusedPane, { name: path.split("/").at(-1) ?? path, path });
        return;
      }

      if (isSupportedPdfPath(path)) {
        openPdfInPane(focusedPane, { name: path.split("/").at(-1) ?? path, path });
        return;
      }

      void window.relic.readMarkdownFile({ path }).then((result) => {
        if (result.ok) {
          openFileInPane(focusedPane, result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [closeTab, focusedPane, leftPane, openFileInPane, openImageInPane, openPdfInPane, rightPane, setWorkspaceError, tabs]
  );

  const handleOpenWikiLink = useCallback(
    (target: string, heading?: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || activeTab.kind !== "file" || !window.relic) return;

      const path = resolveWikiLinkPathWithAliases(target, activeTab.path, existingMarkdownPaths, aliasesByPath);
      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownFile({ path }).then((readResult) => {
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (heading) setScrollHeading(heading);
          return;
        }

        void window.relic!.createLinkedMarkdownFile({ path }).then((createResult) => {
          if (createResult.ok) {
            setWorkspaceState(createResult.value.workspaceState);
            openFileInPane(focusedPane, createResult.value.file);
          } else {
            setWorkspaceError(createResult.error.message);
          }
        });
      });
    },
    [
      aliasesByPath,
      existingMarkdownPaths,
      focusedPane,
      leftPane,
      openFileInPane,
      rightPane,
      setLeftPaneScrollHeading,
      setRightPaneScrollHeading,
      setWorkspaceError,
      setWorkspaceState,
      tabs
    ]
  );

  const handleOpenMarkdownLink = useCallback(
    (href: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || activeTab.kind !== "file" || !window.relic) return;

      const resolved = resolveMarkdownLinkPath(href, activeTab.path);
      if (!resolved) return;

      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownFile({ path: resolved.path }).then((readResult) => {
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (resolved.heading) setScrollHeading(resolved.heading);
          return;
        }

        void window.relic!.createLinkedMarkdownFile({ path: resolved.path }).then((createResult) => {
          if (createResult.ok) {
            setWorkspaceState(createResult.value.workspaceState);
            openFileInPane(focusedPane, createResult.value.file);
            if (resolved.heading) setScrollHeading(resolved.heading);
          } else {
            setWorkspaceError(createResult.error.message);
          }
        });
      });
    },
    [
      focusedPane,
      leftPane,
      openFileInPane,
      rightPane,
      setLeftPaneScrollHeading,
      setRightPaneScrollHeading,
      setWorkspaceError,
      setWorkspaceState,
      tabs
    ]
  );

  return {
    handleOpenFile,
    handleOpenMarkdownLink,
    handleOpenWikiLink
  };
}
