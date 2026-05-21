import type { FeatureToggles, CardbookState } from "../shared/ipc";
import type { Translator } from "./i18n";
import type { PaneState, PanelTabKind, Tab } from "./store/editorStore";
import type { SidebarView } from "./store/uiStore";

export type AppRailViewId = SidebarView | PanelTabKind;

export interface AppRailView<TIcon = unknown> {
  icon: TIcon;
  id: AppRailViewId;
  label: string;
}

export function registeredCardbooksForState(
  cardbookState: CardbookState | null
): CardbookState["cardbooks"] {
  if (!cardbookState) return [];
  if (cardbookState.cardbooks.length > 0) return cardbookState.cardbooks;

  return cardbookState.activeCardbook ? [cardbookState.activeCardbook] : [];
}

export function openCardPathsForTabs(tabs: Record<string, Tab>): Set<string> {
  return new Set(
    Object.values(tabs)
      .filter((tab) => tab.kind === "card")
      .map((tab) => tab.path)
  );
}

export function panelLabelsForTranslator(t: Translator): Record<PanelTabKind, string> {
  return {
    "calendar-settings": t("nav.calendarSettings"),
    frontmatter: t("nav.frontmatter"),
    settings: t("nav.settings"),
    tools: t("nav.tools")
  };
}

export function openPanelTabIdsForTabs(tabs: Record<string, Tab>): Set<PanelTabKind> {
  return new Set(
    Object.values(tabs)
      .filter((tab) => tab.kind === "panel")
      .map((tab) => tab.panel)
  );
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
  return Object.values(tabs).some((tab) => tab.kind === "timeline" && tab.chartId === chartId);
}

export function isChartTabActiveInPanes(
  leftPane: Pick<PaneState, "activeTabId">,
  rightPane: Pick<PaneState, "activeTabId">,
  tabs: Record<string, Tab>,
  chartId = "charts"
): boolean {
  return [leftPane.activeTabId, rightPane.activeTabId].some((tabId) => {
    const tab = tabId ? tabs[tabId] : null;

    return tab?.kind === "timeline" && tab.chartId === chartId;
  });
}

export function enabledRailViewsForFeatures<TView extends Pick<AppRailView, "id">>(
  views: TView[],
  featureToggles: Pick<FeatureToggles, "frontmatter" | "tools">
): TView[] {
  return views.filter((view) => {
    if (view.id === "tools" && !featureToggles.tools) return false;
    if (view.id === "frontmatter" && !featureToggles.frontmatter) return false;

    return true;
  });
}

export function splitRailViews<TView extends Pick<AppRailView, "id">>(
  views: TView[]
): {
  chartRailView: TView | undefined;
  panelRailViews: TView[];
  primaryRailViews: TView[];
} {
  return {
    chartRailView: views.find((view) => view.id === "timeline"),
    panelRailViews: views.filter((view) =>
      view.id !== "cards" &&
      view.id !== "timeline"
    ),
    primaryRailViews: views.filter((view) =>
      view.id === "cards"
    )
  };
}
