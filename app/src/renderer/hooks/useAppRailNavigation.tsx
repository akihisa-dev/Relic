import { useCallback, useMemo, useRef } from "react";
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
import { sidebarViewDefs } from "../components/railNavigationViews";
import type { Translator } from "../i18nModel";
import { useEditorStore, type PaneId, type PaneState, type PanelTabKind, type Tab } from "../store/editorStore";

interface UseAppRailNavigationInput {
  clearRailTabFlight: () => void;
  closeSidebar: () => void;
  featureToggles: FeatureToggles;
  focusedPane: PaneId;
  leftPane: PaneState;
  openChartInPane: (pane: PaneId, chart: { id: string; name: string }) => void;
  openPanelInPane: (pane: PaneId, panel: PanelTabKind, label: string) => void;
  rightPane: PaneState;
  setTabActive: (pane: PaneId, tabId: string) => void;
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
}

export function useAppRailNavigation({
  clearRailTabFlight,
  closeSidebar,
  featureToggles,
  focusedPane,
  leftPane,
  openChartInPane,
  openPanelInPane,
  rightPane,
  setTabActive,
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
  const nextOpenPanelTabIds = useMemo(() => openPanelTabIdsForTabs(tabs), [tabs]);
  const nextOpenChartIds = useMemo(() => openChartIdsForTabs(tabs), [tabs]);
  const nextActivePanelTabIds = useMemo(
    () => activePanelTabIdsForPanes(leftPane, rightPane, tabs),
    [leftPane, rightPane, tabs]
  );
  const nextActiveChartIds = useMemo(
    () => activeChartIdsForPanes(leftPane, rightPane, tabs),
    [leftPane, rightPane, tabs]
  );
  const openPanelTabIds = useStableSet(nextOpenPanelTabIds);
  const openChartIds = useStableSet(nextOpenChartIds);
  const activePanelTabIds = useStableSet(nextActivePanelTabIds);
  const activeChartIds = useStableSet(nextActiveChartIds);
  const enabledRailViews = useMemo(
    () => enabledRailViewsForFeatures(sidebarViews, featureToggles),
    [featureToggles, sidebarViews]
  );
  const { chartRailViews, panelRailViews, primaryRailViews } = useMemo(
    () => splitRailViews(enabledRailViews),
    [enabledRailViews]
  );

  const renderPanelTabIcon = useCallback((panel: PanelTabKind): ReactNode => (
    sidebarViews.find((view) => view.id === panel)?.icon ?? null
  ), [sidebarViews]);

  const handleRailPanelButton = useCallback((panel: PanelTabKind, _label: string, event: MouseEvent<HTMLButtonElement>): void => {
    void event;
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
    clearRailTabFlight();
  }, [clearRailTabFlight, focusedPane, openPanelInPane, panelLabels, setTabActive]);

  const handleRailChartButton = useCallback((view: AppRailViewId, label: string, event: MouseEvent<HTMLButtonElement>): void => {
    void event;
    const chartId = chartIdForRailView(view);
    if (!chartId) return;

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
    clearRailTabFlight();
  }, [
    clearRailTabFlight,
    closeSidebar,
    focusedPane,
    openChartInPane,
    setTabActive
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
    renderPanelTabIcon
  };
}

function useStableSet<T>(value: Set<T>): Set<T> {
  const stableRef = useRef(value);
  if (!setsEqual(stableRef.current, value)) stableRef.current = value;
  return stableRef.current;
}

function setsEqual<T>(left: Set<T>, right: Set<T>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}
