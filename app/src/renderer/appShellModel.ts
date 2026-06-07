import type { FeatureToggles, WorkspaceState } from "../shared/ipc";
import type { Translator } from "./i18nModel";
import type { PaneState, PanelTabKind, Tab } from "./store/editorStore";
import type { SidebarView } from "./store/uiStore";

export type AppRailViewId = SidebarView | PanelTabKind;

export interface AppRailView<TIcon = unknown> {
  icon: TIcon;
  id: AppRailViewId;
  label: string;
}

export function chartIdForRailView(id: AppRailViewId): string | null {
  if (id === "chronicle") return "chronicle";
  if (id === "calendar") return "date";

  return null;
}

export function registeredWorkspacesForState(
  workspaceState: WorkspaceState | null
): WorkspaceState["workspaces"] {
  if (!workspaceState) return [];
  if (workspaceState.workspaces.length > 0) return workspaceState.workspaces;

  return workspaceState.activeWorkspace ? [workspaceState.activeWorkspace] : [];
}

export function openFilePathsForTabs(tabs: Record<string, Tab>): Set<string> {
  return Object.values(tabs).reduce<Set<string>>((paths, tab) => {
    if (tab.kind === "file") paths.add(tab.path);
    return paths;
  }, new Set());
}

export function panelLabelsForTranslator(t: Translator): Record<PanelTabKind, string> {
  return {
    chronicleSettings: t("nav.chronicleSettings"),
    frontmatter: t("nav.frontmatter"),
    settings: t("nav.settings"),
    tools: t("nav.tools")
  };
}

export function openPanelTabIdsForTabs(tabs: Record<string, Tab>): Set<PanelTabKind> {
  return Object.values(tabs).reduce<Set<PanelTabKind>>((panels, tab) => {
    if (tab.kind === "panel") panels.add(tab.panel);
    return panels;
  }, new Set());
}

export function activePanelTabIdsForPanes(
  leftPane: Pick<PaneState, "activeTabId">,
  rightPane: Pick<PaneState, "activeTabId">,
  tabs: Record<string, Tab>
): Set<PanelTabKind> {
  return new Set(
    [leftPane.activeTabId, rightPane.activeTabId]
      .map((tabId) => (tabId ? tabs[tabId] : null))
      .filter((tab): tab is Extract<Tab, { kind: "panel" }> => tab?.kind === "panel")
      .map((tab) => tab.panel)
  );
}

export function isChartTabOpenInTabs(tabs: Record<string, Tab>, chartId = "charts"): boolean {
  return Object.values(tabs).some((tab) => tab.kind === "chart" && tab.chartId === chartId);
}

export function openChartIdsForTabs(tabs: Record<string, Tab>): Set<string> {
  return new Set(
    Object.values(tabs)
      .filter((tab): tab is Extract<Tab, { kind: "chart" }> => tab.kind === "chart")
      .map((tab) => tab.chartId)
  );
}

export function isChartTabActiveInPanes(
  leftPane: Pick<PaneState, "activeTabId">,
  rightPane: Pick<PaneState, "activeTabId">,
  tabs: Record<string, Tab>,
  chartId = "charts"
): boolean {
  return [leftPane.activeTabId, rightPane.activeTabId].some((tabId) => {
    const tab = tabId ? tabs[tabId] : null;

    return tab?.kind === "chart" && tab.chartId === chartId;
  });
}

export function activeChartIdsForPanes(
  leftPane: Pick<PaneState, "activeTabId">,
  rightPane: Pick<PaneState, "activeTabId">,
  tabs: Record<string, Tab>
): Set<string> {
  return new Set(
    [leftPane.activeTabId, rightPane.activeTabId]
      .map((tabId) => (tabId ? tabs[tabId] : null))
      .filter((tab): tab is Extract<Tab, { kind: "chart" }> => tab?.kind === "chart")
      .map((tab) => tab.chartId)
  );
}

export function enabledRailViewsForFeatures<TView extends Pick<AppRailView, "id">>(
  views: TView[],
  featureToggles: Pick<FeatureToggles, "calendar" | "chronicle" | "chronicleSettings" | "frontmatter" | "tools">
): TView[] {
  return views.filter((view) => {
    if (view.id === "tools" && !featureToggles.tools) return false;
    if (view.id === "frontmatter" && !featureToggles.frontmatter) return false;
    if (view.id === "chronicleSettings" && !featureToggles.chronicleSettings) return false;
    if (view.id === "chronicle" && !featureToggles.chronicle) return false;
    if (view.id === "calendar" && !featureToggles.calendar) return false;

    return true;
  });
}

export function splitRailViews<TView extends Pick<AppRailView, "id">>(
  views: TView[]
): {
  chartRailViews: TView[];
  panelRailViews: TView[];
  primaryRailViews: TView[];
} {
  return {
    chartRailViews: views.filter((view) => chartIdForRailView(view.id) !== null),
    panelRailViews: views.filter((view) =>
      view.id !== "files" &&
      chartIdForRailView(view.id) === null
    ),
    primaryRailViews: views.filter((view) =>
      view.id === "files"
    )
  };
}
