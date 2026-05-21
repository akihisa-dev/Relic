import { useCallback, useRef } from "react";
import type { MouseEvent } from "react";

import type { MarkdownCardContent } from "../../shared/ipc";
import type { Translator } from "../i18n";
import { useEditorStore, type PaneId } from "../store/editorStore";
import { displayNameFromPath } from "../cardbookPaths";
import type { RailTabFlight, SidebarCreateFlight } from "./useRailFlights";

interface UseSidebarCardInteractionsInput {
  focusedPane: PaneId;
  handleCreateCard: () => void;
  handleCreateCardFolder: () => void;
  handleOpenCard: (path: string) => void;
  openCardInPane: (pane: PaneId, card: MarkdownCardContent) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  setCardbookError: (message: string | null) => void;
  showRailTabFlight: (flight: RailTabFlight, duration?: number) => void;
  showSidebarCreateFlight: (flight: SidebarCreateFlight, duration?: number) => void;
  t: Translator;
}

export function useSidebarCardInteractions({
  focusedPane,
  handleCreateCard,
  handleCreateCardFolder,
  handleOpenCard,
  openCardInPane,
  setTabActive,
  setCardbookError,
  showRailTabFlight,
  showSidebarCreateFlight,
  t
}: UseSidebarCardInteractionsInput): {
  handleCreateCardFromSidebar: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleCreateCardFolderFromSidebar: (event?: MouseEvent<HTMLButtonElement>) => void;
  handleSidebarOpenCard: (path: string, event?: MouseEvent<HTMLButtonElement>) => void;
} {
  const pendingSidebarCardOpenTokensRef = useRef<Record<string, number>>({});
  const sidebarCardOpenTokenRef = useRef(0);

  const handleSidebarOpenCard = useCallback((path: string, event?: MouseEvent<HTMLButtonElement>): void => {
    if (!event) {
      handleOpenCard(path);
      return;
    }

    const rowRect = event.currentTarget.getBoundingClientRect();
    const editorState = useEditorStore.getState();
    const targetPane = editorState.focusedPane;
    const paneState = targetPane === "left" ? editorState.leftPane : editorState.rightPane;
    const tabBar = document.querySelector(`.pane${targetPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
    const tabBarRect = tabBar?.getBoundingClientRect();
    const pendingToken = pendingSidebarCardOpenTokensRef.current[path];

    if (pendingToken) {
      delete pendingSidebarCardOpenTokensRef.current[path];
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
      return tab?.kind === "card" && tab.path === path;
    });
    const openTabInPane = openTabIdInPane ? editorState.tabs[openTabIdInPane] : null;

    if (openTabIdInPane && openTabInPane?.kind === "card") {
      setTabActive(targetPane, openTabIdInPane);
      return;
    }

    const existingTab = Object.values(editorState.tabs).find((tab) => tab.kind === "card" && tab.path === path);
    const label = existingTab?.name ?? displayNameFromPath(path);

    showRailTabFlight({
      direction: "open",
      fromX: rowRect.left + rowRect.width / 2,
      fromY: rowRect.top + rowRect.height / 2,
      label,
      toX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
      toY: (tabBarRect?.top ?? rowRect.top) + 15
    });

    if (existingTab?.kind === "card") {
      openCardInPane(targetPane, { content: existingTab.content, name: existingTab.name, path: existingTab.path });
      return;
    }

    if (!window.relic) return;

    setCardbookError(null);
    const token = sidebarCardOpenTokenRef.current + 1;
    sidebarCardOpenTokenRef.current = token;
    pendingSidebarCardOpenTokensRef.current[path] = token;
    void window.relic.readMarkdownCard({ path }).then((result) => {
      if (pendingSidebarCardOpenTokensRef.current[path] !== token) return;
      delete pendingSidebarCardOpenTokensRef.current[path];
      if (result.ok) {
        openCardInPane(targetPane, result.value);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [handleOpenCard, openCardInPane, setTabActive, setCardbookError, showRailTabFlight]);

  const handleCreateCardFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tabBar = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const tabBarRect = tabBar?.getBoundingClientRect();

      showRailTabFlight({
        direction: "open",
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("cards.createNote"),
        toX: (tabBarRect?.left ?? buttonRect.left + buttonRect.width + 120) + 48,
        toY: (tabBarRect?.top ?? buttonRect.top) + 15
      });
    }

    handleCreateCard();
  }, [focusedPane, handleCreateCard, showRailTabFlight, t]);

  const handleCreateCardFolderFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tree = document.querySelector(".sidebar-view-content--cards .card-tree");
      const treeRect = tree?.getBoundingClientRect();

      showSidebarCreateFlight({
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("cards.createCardFolder"),
        toX: (treeRect?.left ?? buttonRect.left) + 24,
        toY: (treeRect?.top ?? buttonRect.top + 72) + 14
      });
    }

    handleCreateCardFolder();
  }, [handleCreateCardFolder, showSidebarCreateFlight, t]);

  return {
    handleCreateCardFromSidebar,
    handleCreateCardFolderFromSidebar,
    handleSidebarOpenCard
  };
}
