import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PaneId, PaneState, Tab } from "../store/editorStore";
import { useEditorStore } from "../store/editorStore";
import type { RailTabFlight } from "./useRailFlights";

const TAB_CLOSE_MOTION_MS = 180;

const paneTabMotionKey = (pane: PaneId, tabId: string): string => `${pane}:${tabId}`;

interface UsePaneTabMotionInput {
  beforeCloseTabs?: (pane: PaneId, tabIds: string[]) => Promise<boolean> | boolean;
  closeAllTabsInPane: (pane: PaneId) => void;
  closeOtherTabs: (pane: PaneId, tabId: string) => void;
  closeTab: (pane: PaneId, tabId: string) => void;
  closeTabsToRight: (pane: PaneId, tabId: string) => void;
  leftPane: PaneState;
  rightPane: PaneState;
  showRailTabFlight: (flight: RailTabFlight, duration?: number) => void;
  tabs: Record<string, Tab>;
}

export function usePaneTabMotion({
  closeAllTabsInPane,
  closeOtherTabs,
  closeTab,
  closeTabsToRight,
  leftPane,
  rightPane,
  showRailTabFlight,
  tabs,
  beforeCloseTabs
}: UsePaneTabMotionInput): {
  closeAllTabsInPaneWithMotion: (pane: PaneId) => void;
  closeOtherTabsWithMotion: (pane: PaneId, tabId: string) => void;
  closeTabWithMotion: (pane: PaneId, tabId: string) => void;
  closeTabsToRightWithMotion: (pane: PaneId, tabId: string) => void;
  leftClosingTabIds: Set<string>;
  rightClosingTabIds: Set<string>;
} {
  const [closingPaneTabs, setClosingPaneTabs] = useState<Set<string>>(() => new Set());
  const closeMotionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = closeMotionTimersRef.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  const clearClosingPaneTabs = useCallback((keys: string[]): void => {
    setClosingPaneTabs((current) => {
      const next = new Set(current);
      for (const key of keys) next.delete(key);
      return next;
    });

    for (const key of keys) {
      delete closeMotionTimersRef.current[key];
    }
  }, []);

  const startTabCloseFlight = useCallback((tabId: string): void => {
    const tab = useEditorStore.getState().tabs[tabId];
    if (!tab) return;

    const tabElement = document.querySelector<HTMLElement>(`.pane-tab[data-tab-id="${tabId}"]`);
    if (!tabElement) return;

    const tabRect = tabElement.getBoundingClientRect();

    showRailTabFlight({
      direction: "close",
      fromX: tabRect.left + tabRect.width / 2,
      fromY: tabRect.top + tabRect.height / 2,
      label: tab.name,
      toX: tabRect.left + tabRect.width / 2,
      toY: tabRect.top + tabRect.height / 2 + 2
    }, 260);
  }, [showRailTabFlight]);

  const closeTabWithMotion = useCallback((pane: PaneId, tabId: string): void => {
    if (!useEditorStore.getState().tabs[tabId]) return;

    const key = paneTabMotionKey(pane, tabId);
    if (closingPaneTabs.has(key)) return;

    void Promise.resolve(beforeCloseTabs?.(pane, [tabId]) ?? true).then((canClose) => {
      if (!canClose) return;

    setClosingPaneTabs((current) => {
      if (current.has(key)) return current;
      return new Set(current).add(key);
    });

    startTabCloseFlight(tabId);

    closeMotionTimersRef.current[key] = setTimeout(() => {
      closeTab(pane, tabId);
      clearClosingPaneTabs([key]);
    }, TAB_CLOSE_MOTION_MS);
    });
  }, [beforeCloseTabs, clearClosingPaneTabs, closeTab, closingPaneTabs, startTabCloseFlight]);

  const closeTabsWithMotion = useCallback((pane: PaneId, tabIds: string[], closeAction: () => void): void => {
    const targetKeys = tabIds
      .filter((tabId) => tabs[tabId])
      .map((tabId) => paneTabMotionKey(pane, tabId))
      .filter((key) => !closingPaneTabs.has(key));

    if (targetKeys.length === 0) return;

    void Promise.resolve(beforeCloseTabs?.(pane, tabIds) ?? true).then((canClose) => {
      if (!canClose) return;

    setClosingPaneTabs((current) => {
      const next = new Set(current);
      for (const key of targetKeys) next.add(key);
      return next;
    });

    const timer = setTimeout(() => {
      closeAction();
      clearClosingPaneTabs(targetKeys);
    }, TAB_CLOSE_MOTION_MS);

    for (const key of targetKeys) {
      closeMotionTimersRef.current[key] = timer;
    }
    });
  }, [beforeCloseTabs, clearClosingPaneTabs, closingPaneTabs, tabs]);

  const leftClosingTabIds = useMemo(
    () => new Set(leftPane.tabIds.filter((tabId) => closingPaneTabs.has(paneTabMotionKey("left", tabId)))),
    [closingPaneTabs, leftPane.tabIds]
  );
  const rightClosingTabIds = useMemo(
    () => new Set(rightPane.tabIds.filter((tabId) => closingPaneTabs.has(paneTabMotionKey("right", tabId)))),
    [closingPaneTabs, rightPane.tabIds]
  );

  const closeOtherTabsWithMotion = useCallback((pane: PaneId, tabId: string): void => {
    const paneState = pane === "left" ? leftPane : rightPane;
    closeTabsWithMotion(
      pane,
      paneState.tabIds.filter((id) => id !== tabId && !tabs[id]?.isPinned),
      () => closeOtherTabs(pane, tabId)
    );
  }, [closeOtherTabs, closeTabsWithMotion, leftPane, rightPane, tabs]);

  const closeTabsToRightWithMotion = useCallback((pane: PaneId, tabId: string): void => {
    const paneState = pane === "left" ? leftPane : rightPane;
    const tabIndex = paneState.tabIds.indexOf(tabId);
    closeTabsWithMotion(
      pane,
      tabIndex === -1 ? [] : paneState.tabIds.slice(tabIndex + 1).filter((id) => !tabs[id]?.isPinned),
      () => closeTabsToRight(pane, tabId)
    );
  }, [closeTabsToRight, closeTabsWithMotion, leftPane, rightPane, tabs]);

  const closeAllTabsInPaneWithMotion = useCallback((pane: PaneId): void => {
    const paneState = pane === "left" ? leftPane : rightPane;
    closeTabsWithMotion(pane, paneState.tabIds.filter((id) => !tabs[id]?.isPinned), () => closeAllTabsInPane(pane));
  }, [closeAllTabsInPane, closeTabsWithMotion, leftPane, rightPane, tabs]);

  return {
    closeAllTabsInPaneWithMotion,
    closeOtherTabsWithMotion,
    closeTabWithMotion,
    closeTabsToRightWithMotion,
    leftClosingTabIds,
    rightClosingTabIds
  };
}
