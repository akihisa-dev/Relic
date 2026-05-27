import { useCallback, useEffect, useMemo } from "react";
import type { MouseEvent, ReactElement, ReactNode } from "react";

import type { FeatureToggles } from "../../shared/ipc";
import {
  activePanelTabIdsForPanes,
  activeChartIdsForPanes,
  chartIdForRailView,
  enabledRailViewsForFeatures,
  openChartIdsForTabs,
  openPanelTabIdsForTabs,
  panelLabelsForTranslator,
  splitRailViews,
  type AppRailView,
  type AppRailViewId
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
  openChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
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
  activeChartIds: Set<string>;
  chartRailViews: Array<AppRailView<ReactElement>>;
  handleRailChartButton: (view: AppRailViewId, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  handleRailPanelButton: (panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>) => void;
  openChartIds: Set<string>;
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
  openChartInPane,
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
  const openChartIds = useMemo(() => openChartIdsForTabs(tabs), [tabs]);
  const activePanelTabIds = useMemo(
    () => activePanelTabIdsForPanes(leftPane, rightPane, tabs),
    [leftPane, rightPane, tabs]
  );
  const activeChartIds = useMemo(
    () => activeChartIdsForPanes(leftPane, rightPane, tabs),
    [leftPane, rightPane, tabs]
  );
  const enabledRailViews = useMemo(
    () => enabledRailViewsForFeatures(sidebarViews, featureToggles),
    [featureToggles, sidebarViews]
  );
  const { chartRailViews, panelRailViews, primaryRailViews } = useMemo(
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

    const panelLabel = panelLabels[panel];
    openPanelInPane(focusedPane, panel, panelLabel);
    showRailOpenFlight(panelLabel, railRect);
  }, [clearRailTabFlight, focusedPane, openPanelInPane, panelLabels, setTabActive, showRailOpenFlight]);

  const handleRailChartButton = useCallback((view: AppRailViewId, label: string, event: MouseEvent<HTMLButtonElement>): void => {
    const chartId = chartIdForRailView(view);
    if (!chartId) return;

    const railRect = event.currentTarget.getBoundingClientRect();
    const tabId = `chart-${chartId}`;
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
    openChartInPane(focusedPane, { id: chartId, name: label });
    showRailOpenFlight(label, railRect);
  }, [
    clearRailTabFlight,
    closeSidebar,
    focusedPane,
    openChartInPane,
    setTabActive,
    showRailOpenFlight
  ]);

  return {
    activePanelTabIds,
    activeChartIds,
    chartRailViews,
    handleRailChartButton,
    handleRailPanelButton,
    openChartIds,
    openPanelTabIds,
    panelLabels,
    panelRailViews,
    primaryRailViews,
    renderPanelTabIcon,
    sidebarViews
  };
}
