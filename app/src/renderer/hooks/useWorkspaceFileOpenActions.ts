import { relicClient } from "../relicClient";
import { useCallback } from "react";

import { isSupportedMarkdownImagePath } from "../../shared/imageFiles";
import { resolveMarkdownLinkPath, resolveWikiLinkPathWithAliases } from "../../shared/links";
import { isSupportedPdfPath } from "../../shared/pdfFiles";
import type { FileTab } from "../store/editorStoreTypes";
import { useAsyncRequestGuard } from "./useAsyncRequestGuard";
import type { WorkspaceFileActionsContext } from "./workspaceFileActionTypes";
import type { WorkspaceRequestGuard } from "./useWorkspaceRequestGuard";

type WorkspaceFileOpenInput = Pick<
  WorkspaceFileActionsContext,
  | "aliasesByPath"
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
> & {
  activeWorkspaceId: string | null;
} & Pick<WorkspaceRequestGuard, "beginWorkspaceRequest">;

export function useWorkspaceFileOpenActions({
  activeWorkspaceId,
  aliasesByPath,
  beginWorkspaceRequest,
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
  const beginLatestOpenRequest = useAsyncRequestGuard([activeWorkspaceId]);
  const beginOpenRequest = useCallback(() => {
    const isLatestRequest = beginLatestOpenRequest();
    const isCurrentWorkspace = beginWorkspaceRequest();
    return () => isLatestRequest() && isCurrentWorkspace();
  }, [beginLatestOpenRequest, beginWorkspaceRequest]);
  const handleOpenFile = useCallback(
    (path: string): void => {
      const relic = relicClient.current;
      if (!relic) return;
      const isCurrentRequest = beginOpenRequest();
      if (!isCurrentRequest()) return;

      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTabId = paneState.activeTabId;
      const activeTab = activeTabId ? tabs[activeTabId] : null;

      if (
        activeTabId &&
        (activeTab?.kind === "file" || activeTab?.kind === "image" || activeTab?.kind === "pdf") &&
        activeTab.path === path
      ) {
        return;
      }

      const existingFileTab = Object.values(tabs).find(
        (tab): tab is FileTab => tab.kind === "file" && tab.path === path
      );
      if (existingFileTab) {
        openFileInPane(focusedPane, {
          content: existingFileTab.content,
          name: existingFileTab.name,
          path: existingFileTab.path
        });
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

      void relic.readMarkdownFile({ path }).then((result) => {
        if (!isCurrentRequest()) return;
        if (result.ok) {
          openFileInPane(focusedPane, result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [beginOpenRequest, focusedPane, leftPane, openFileInPane, openImageInPane, openPdfInPane, rightPane, setWorkspaceError, tabs]
  );

  const handleOpenWikiLink = useCallback(
    (target: string, heading?: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      const relic = relicClient.current;
      if (!activeTab || activeTab.kind !== "file" || !relic) return;
      const isCurrentRequest = beginOpenRequest();
      if (!isCurrentRequest()) return;

      const path = resolveWikiLinkPathWithAliases(target, activeTab.path, existingMarkdownPaths, aliasesByPath);
      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void relic.readMarkdownFile({ path }).then((readResult) => {
        if (!isCurrentRequest()) return;
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (heading) setScrollHeading(heading);
          return;
        }

        void relic.createLinkedMarkdownFile({ path }).then((createResult) => {
          if (!isCurrentRequest()) return;
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
      beginOpenRequest,
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

      const relic = relicClient.current;
      if (!activeTab || activeTab.kind !== "file" || !relic) return;
      const isCurrentRequest = beginOpenRequest();
      if (!isCurrentRequest()) return;

      const resolved = resolveMarkdownLinkPath(href, activeTab.path);
      if (!resolved) return;

      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void relic.readMarkdownFile({ path: resolved.path }).then((readResult) => {
        if (!isCurrentRequest()) return;
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (resolved.heading) setScrollHeading(resolved.heading);
          return;
        }

        void relic.createLinkedMarkdownFile({ path: resolved.path }).then((createResult) => {
          if (!isCurrentRequest()) return;
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
      beginOpenRequest,
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
