import { useCallback, useEffect, useMemo } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

import type { FeatureToggles } from "../../shared/ipc";
import {
  activePanelTabIdsForPanes,
  enabledRailViewsForFeatures,
  isChartTabActiveInPanes,
  isChartTabOpenInTabs,
  openPanelTabIdsForTabs,
  panelLabelsForTranslator,
  splitRailViews,
  type AppRailView
} from "../appShellModel";
import { sidebarViewDefs } from "../components/RailNavigation";
import type { Translator } from "../i18n";
import { useEditorStore, type PaneId, type PaneState, type PanelTabKind, type Tab } from "../store/editorStore";
import type { SidebarView } from "../store/uiStore";

interface UseAppRailNavigationInput {
  activeSidebarView: SidebarView;
  clearRailTabFlight: () => void;
  closeSidebar: () => void;
  featureToggles: FeatureToggles;
  focusedPane: PaneId;
  leftPane: PaneState;
  openGanttChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, label: string) => void;
  rightPane: PaneState;
  setSidebarView: (view: SidebarView) => void;
  setTabActive: (pane: PaneId, tabId: string) => void;
  showRailTabFlight: (flight: {
    direction: "open" | "close";
    fromX: number;
    fromY: number;
    label: string;
    toX: number;
    toY: number;
  }) => void;
  t: Translator;
  tabs: Record<string, Tab>;
}

export interface UseAppRailNavigationResult {
  activePanelTabIds: Set<PanelTabKind>;
  chartRailView?: AppRailView<ReactElement>;
  handleRailChartButton: (label: string, event: MouseEvent<HTMLButtonElement>) => void;
  handleRailPanelButton: (panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  isChartTabActive: boolean;
  isChartTabOpen: boolean;
  openPanelTabIds: Set<PanelTabKind>;
  panelLabels: Record<PanelTabKind, string>;
  panelRailViews: Array<AppRailView<ReactElement>>;
  primaryRailViews: Array<AppRailView<ReactElement>>;
  renderPanelTabIcon: (panel: PanelTabKind) => ReactNode;
  sidebarViews: Array<AppRailView<ReactElement>>;
}

export function useAppRailNavigation({
  activeSidebarView,
  clearRailTabFlight,
  closeSidebar,
  featureToggles,
  focusedPane,
  leftPane,
  openGanttChartInPane,
  openPanelInPane,
  rightPane,
  setSidebarView,
  setTabActive,
  showRailTabFlight,
  t,
  tabs
}: UseAppRailNavigationInput): UseAppRailNavigationResult {
  const sidebarViews = useMemo<Array<AppRailView<ReactElement>>>(
    () =>
      sidebarViewDefs.map((view) => ({
        ...view,
        label: t(view.labelKey)
      })),
    [t]
  );
  const panelLabels = useMemo(() => panelLabelsForTranslator(t), [t]);
  const openPanelTabIds = useMemo(() => openPanelTabIdsForTabs(tabs), [tabs]);
  const activePanelTabIds = useMemo(
    () => activePanelTabIdsForPanes(leftPane, rightPane, tabs),
    [leftPane, rightPane, tabs]
  );
  const isChartTabOpen = useMemo(
    () => isChartTabOpenInTabs(tabs),
    [tabs]
  );
  const isChartTabActive = useMemo(
    () => isChartTabActiveInPanes(leftPane, rightPane, tabs),
    [leftPane, rightPane, tabs]
  );
  const enabledRailViews = useMemo(
    () => enabledRailViewsForFeatures(sidebarViews, featureToggles),
    [featureToggles, sidebarViews]
  );
  const { chartRailView, panelRailViews, primaryRailViews } = useMemo(
    () => splitRailViews(enabledRailViews),
    [enabledRailViews]
  );

  useEffect(() => {
    if (
      activeSidebarView !== "tools" &&
      activeSidebarView !== "frontmatter" &&
      activeSidebarView !== "settings"
    ) {
      return;
    }

    openPanelInPane(focusedPane, activeSidebarView, panelLabels[activeSidebarView]);
    setSidebarView("files");
  }, [activeSidebarView, focusedPane, openPanelInPane, panelLabels, setSidebarView]);

  const renderPanelTabIcon = useCallback((panel: PanelTabKind): ReactNode => (
    sidebarViews.find((view) => view.id === panel)?.icon ?? null
  ), [sidebarViews]);

  const showRailOpenFlight = useCallback((
    label: string,
    railRect: DOMRect
  ): void => {
    requestAnimationFrame(() => {
      const pane = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const toRect = pane?.getBoundingClientRect();
      showRailTabFlight({
        direction: "open",
        fromX: railRect.left + railRect.width / 2,
        fromY: railRect.top + railRect.height / 2,
        label,
        toX: (toRect?.left ?? railRect.left + 180) + 48,
        toY: (toRect?.top ?? railRect.top) + 15
      });
    });
  }, [focusedPane, showRailTabFlight]);

  const handleRailPanelButton = useCallback((panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>): void => {
    const railRect = event.currentTarget.getBoundingClientRect();
    const panelTabId = `panel-${panel}`;
    const editorState = useEditorStore.getState();
    const openedPanes: PaneId[] = [
      ...(editorState.leftPane.tabIds.includes(panelTabId) ? ["left" as const] : []),
      ...(editorState.rightPane.tabIds.includes(panelTabId) ? ["right" as const] : [])
    ];

    if (openedPanes.length > 0) {
      clearRailTabFlight();
      setTabActive(openedPanes.includes(focusedPane) ? focusedPane : openedPanes[0], panelTabId);
      return;
    }

    openPanelInPane(focusedPane, panel, label);
    showRailOpenFlight(label, railRect);
  }, [clearRailTabFlight, focusedPane, openPanelInPane, setTabActive, showRailOpenFlight]);

  const handleRailChartButton = useCallback((label: string, event: MouseEvent<HTMLButtonElement>): void => {
    const railRect = event.currentTarget.getBoundingClientRect();
    const tabId = "gantt-charts";
    const editorState = useEditorStore.getState();
    const openedPanes: PaneId[] = [
      ...(editorState.leftPane.tabIds.includes(tabId) ? ["left" as const] : []),
      ...(editorState.rightPane.tabIds.includes(tabId) ? ["right" as const] : [])
    ];

    if (openedPanes.length > 0) {
      closeSidebar();
      clearRailTabFlight();
      setTabActive(openedPanes.includes(focusedPane) ? focusedPane : openedPanes[0], tabId);
      return;
    }

    closeSidebar();
    openGanttChartInPane(focusedPane, { id: "charts", name: label });
    showRailOpenFlight(label, railRect);
  }, [
    clearRailTabFlight,
    closeSidebar,
    focusedPane,
    openGanttChartInPane,
    setTabActive,
    showRailOpenFlight
  ]);

  return {
    activePanelTabIds,
    chartRailView,
    handleRailChartButton,
    handleRailPanelButton,
    isChartTabActive,
    isChartTabOpen,
    openPanelTabIds,
    panelLabels,
    panelRailViews,
    primaryRailViews,
    renderPanelTabIcon,
    sidebarViews
  };
}
