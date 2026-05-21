import { useCallback } from "react";

import type { MarkdownCardContent, CardbookState, CardbookTreeNode } from "../../shared/ipc";
import type { Translator } from "../i18n";
import type { PaneId, PanelTabKind, Tab } from "../store/editorStore";
import { joinCardbookPath } from "../cardbookPaths";

interface UseAppPaneCardActionsInput {
  focusedPane: PaneId;
  handleDuplicateTreeCard: (path: string) => void;
  isSplit: boolean;
  openCardInPane: (pane: PaneId, card: MarkdownCardContent) => void;
  openTimelineChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, name: string) => void;
  setLeftPaneScrollHeading: (heading: string | undefined) => void;
  setRightPaneScrollHeading: (heading: string | undefined) => void;
  setCardbookError: (message: string | null) => void;
  setCardbookState: (state: CardbookState) => void;
  t: Translator;
  tabs: Record<string, Tab>;
}

function ensureMarkdownExtension(name: string): string {
  return name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
}

export function useAppPaneCardActions({
  focusedPane,
  handleDuplicateTreeCard,
  isSplit,
  openCardInPane,
  openTimelineChartInPane,
  openPanelInPane,
  setLeftPaneScrollHeading,
  setRightPaneScrollHeading,
  setCardbookError,
  setCardbookState,
  t,
  tabs
}: UseAppPaneCardActionsInput): {
  handleCreateCardInCardFolder: (cardFolderPath: string) => void;
  handleCreateCardFolderInCardFolder: (cardFolderPath: string) => void;
  handleDuplicateTabCard: (tabId: string) => void;
  handleRevealTabCard: (tabId: string) => void;
  handleRevealCardbookItem: (path: string) => void;
  handleSelectCardFolder: (node: Extract<CardbookTreeNode, { type: "cardFolder" }>) => void;
  openCardInOtherPane: (fromPane: PaneId, tabId: string) => void;
  openTreeCardInOtherPane: (path: string) => void;
  openCardbookPathInOtherPane: (path: string, heading?: string) => void;
} {
  const openCardInOtherPane = useCallback((fromPane: PaneId, tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || !isSplit) return;
    const otherPane = fromPane === "left" ? "right" : "left";
    if (tab.kind === "card") {
      openCardInPane(otherPane, { content: tab.content, name: tab.name, path: tab.path });
    } else if (tab.kind === "panel") {
      openPanelInPane(otherPane, tab.panel, tab.name);
    } else {
      openTimelineChartInPane(otherPane, { id: tab.chartId, name: tab.name });
    }
  }, [tabs, isSplit, openCardInPane, openTimelineChartInPane, openPanelInPane]);

  const openTreeCardInOtherPane = useCallback((path: string): void => {
    if (!window.relic || !isSplit) return;
    const otherPane = focusedPane === "left" ? "right" : "left";

    void window.relic.readMarkdownCard({ path }).then((result) => {
      if (result.ok) {
        openCardInPane(otherPane, result.value);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [focusedPane, isSplit, openCardInPane, setCardbookError]);

  const openCardbookPathInOtherPane = useCallback((path: string, heading?: string): void => {
    if (!window.relic || !isSplit) return;
    const relic = window.relic;
    const otherPane = focusedPane === "left" ? "right" : "left";
    const setScrollHeading = otherPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

    void relic.readMarkdownCard({ path }).then((readResult) => {
      if (readResult.ok) {
        openCardInPane(otherPane, readResult.value);
        if (heading) setScrollHeading(heading);
        return;
      }

      void relic.createLinkedMarkdownCard({ path }).then((createResult) => {
        if (createResult.ok) {
          setCardbookState(createResult.value.cardbookState);
          openCardInPane(otherPane, createResult.value.card);
          if (heading) setScrollHeading(heading);
        } else {
          setCardbookError(createResult.error.message);
        }
      });
    });
  }, [
    focusedPane,
    isSplit,
    openCardInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setCardbookError,
    setCardbookState
  ]);

  const handleCreateCardInCardFolder = useCallback((cardFolderPath: string): void => {
    if (!window.relic) return;
    const cardName = window.prompt(t("cards.newNoteName"), t("cards.defaultNewNoteName"));
    if (cardName === null) return;
    const trimmedCardName = cardName.trim();
    if (!trimmedCardName) return;

    const nextPath = joinCardbookPath(cardFolderPath, ensureMarkdownExtension(trimmedCardName));

    setCardbookError(null);
    void window.relic.createLinkedMarkdownCard({ path: nextPath }).then((result) => {
      if (result.ok) {
        setCardbookState(result.value.cardbookState);
        openCardInPane(focusedPane, result.value.card);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [focusedPane, openCardInPane, setCardbookError, setCardbookState, t]);

  const handleCreateCardFolderInCardFolder = useCallback((cardFolderPath: string): void => {
    if (!window.relic) return;
    const cardFolderName = window.prompt(t("cards.newCardFolderName"), t("cards.defaultNewCardFolderName"));
    if (cardFolderName === null) return;
    const trimmedCardFolderName = cardFolderName.trim();
    if (!trimmedCardFolderName) return;

    setCardbookError(null);
    void window.relic.createCardFolder({ name: trimmedCardFolderName, parentCardFolder: cardFolderPath }).then((result) => {
      if (result.ok) {
        setCardbookState(result.value);
      } else {
        setCardbookError(result.error.message);
      }
    });
  }, [setCardbookError, setCardbookState, t]);

  const handleRevealCardbookItem = useCallback((path: string): void => {
    if (!window.relic) return;

    setCardbookError(null);
    void window.relic.revealCardbookItem({ path }).then((result) => {
      if (!result.ok) setCardbookError(result.error.message);
    });
  }, [setCardbookError]);

  const handleDuplicateTabCard = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "card") return;
    handleDuplicateTreeCard(tab.path);
  }, [handleDuplicateTreeCard, tabs]);

  const handleRevealTabCard = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "card") return;
    handleRevealCardbookItem(tab.path);
  }, [handleRevealCardbookItem, tabs]);

  const handleSelectCardFolder = useCallback(
    (node: Extract<CardbookTreeNode, { type: "cardFolder" }>): void => {
      void node; // フェーズ2ではカードフォルダ選択は何もしない
    },
    []
  );

  return {
    handleCreateCardInCardFolder,
    handleCreateCardFolderInCardFolder,
    handleDuplicateTabCard,
    handleRevealTabCard,
    handleRevealCardbookItem,
    handleSelectCardFolder,
    openCardInOtherPane,
    openTreeCardInOtherPane,
    openCardbookPathInOtherPane
  };
}
