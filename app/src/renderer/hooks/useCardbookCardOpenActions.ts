import { useCallback } from "react";

import { resolveMarkdownLinkPath, resolveWikiLinkPathWithAliases } from "../../shared/links";
import type { CardbookCardActionsContext } from "./cardbookCardActionTypes";

type CardbookCardOpenInput = Pick<
  CardbookCardActionsContext,
  | "aliasesByPath"
  | "closeTab"
  | "existingMarkdownPaths"
  | "focusedPane"
  | "leftPane"
  | "openCardInPane"
  | "rightPane"
  | "setLeftPaneScrollHeading"
  | "setRightPaneScrollHeading"
  | "setCardbookError"
  | "setCardbookState"
  | "tabs"
>;

export function useCardbookCardOpenActions({
  aliasesByPath,
  closeTab,
  existingMarkdownPaths,
  focusedPane,
  leftPane,
  openCardInPane,
  rightPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setCardbookError,
  setCardbookState,
  tabs
}: CardbookCardOpenInput) {
  const handleOpenCard = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTabId = paneState.activeTabId;
      const activeTab = activeTabId ? tabs[activeTabId] : null;

      if (activeTabId && activeTab?.kind === "card" && activeTab.path === path) {
        closeTab(focusedPane, activeTabId);
        return;
      }

      void window.relic.readMarkdownCard({ path }).then((result) => {
        if (result.ok) {
          openCardInPane(focusedPane, result.value);
        } else {
          setCardbookError(result.error.message);
        }
      });
    },
    [closeTab, focusedPane, leftPane, openCardInPane, rightPane, setCardbookError, tabs]
  );

  const handleOpenWikiLink = useCallback(
    (target: string, heading?: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || activeTab.kind !== "card" || !window.relic) return;

      const path = resolveWikiLinkPathWithAliases(target, activeTab.path, existingMarkdownPaths, aliasesByPath);
      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownCard({ path }).then((readResult) => {
        if (readResult.ok) {
          openCardInPane(focusedPane, readResult.value);
          if (heading) setScrollHeading(heading);
          return;
        }

        void window.relic!.createLinkedMarkdownCard({ path }).then((createResult) => {
          if (createResult.ok) {
            setCardbookState(createResult.value.cardbookState);
            openCardInPane(focusedPane, createResult.value.card);
          } else {
            setCardbookError(createResult.error.message);
          }
        });
      });
    },
    [
      aliasesByPath,
      existingMarkdownPaths,
      focusedPane,
      leftPane,
      openCardInPane,
      rightPane,
      setLeftPaneScrollHeading,
      setRightPaneScrollHeading,
      setCardbookError,
      setCardbookState,
      tabs
    ]
  );

  const handleOpenMarkdownLink = useCallback(
    (href: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || activeTab.kind !== "card" || !window.relic) return;

      const resolved = resolveMarkdownLinkPath(href, activeTab.path);
      if (!resolved) return;

      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownCard({ path: resolved.path }).then((readResult) => {
        if (readResult.ok) {
          openCardInPane(focusedPane, readResult.value);
          if (resolved.heading) setScrollHeading(resolved.heading);
          return;
        }

        void window.relic!.createLinkedMarkdownCard({ path: resolved.path }).then((createResult) => {
          if (createResult.ok) {
            setCardbookState(createResult.value.cardbookState);
            openCardInPane(focusedPane, createResult.value.card);
            if (resolved.heading) setScrollHeading(resolved.heading);
          } else {
            setCardbookError(createResult.error.message);
          }
        });
      });
    },
    [
      focusedPane,
      leftPane,
      openCardInPane,
      rightPane,
      setLeftPaneScrollHeading,
      setRightPaneScrollHeading,
      setCardbookError,
      setCardbookState,
      tabs
    ]
  );

  return {
    handleOpenCard,
    handleOpenMarkdownLink,
    handleOpenWikiLink
  };
}
