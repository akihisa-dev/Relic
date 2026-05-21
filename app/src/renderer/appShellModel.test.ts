import { describe, expect, it } from "vitest";

import { defaultFeatureToggles, type CardbookState } from "../shared/ipc";
import {
  activePanelTabIdsForPanes,
  enabledRailViewsForFeatures,
  isChartTabActiveInPanes,
  isChartTabOpenInTabs,
  openCardPathsForTabs,
  openPanelTabIdsForTabs,
  panelLabelsForTranslator,
  registeredCardbooksForState,
  splitRailViews,
  type AppRailView
} from "./appShellModel";
import { createTranslator } from "./i18n";
import type { PaneState, Tab } from "./store/editorStore";

const emptyPane = (activeTabId: string | null = null): PaneState => ({
  activeTabId,
  history: activeTabId ? [activeTabId] : [],
  tabIds: activeTabId ? [activeTabId] : []
});

const tabs: Record<string, Tab> = {
  "timeline-charts": { chartId: "charts", id: "timeline-charts", kind: "timeline", name: "Timeline" },
  "timeline-custom": { chartId: "custom", id: "timeline-custom", kind: "timeline", name: "Custom" },
  "panel-calendar-settings": { id: "panel-calendar-settings", kind: "panel", name: "Calendar Settings", panel: "calendar-settings" },
  "panel-frontmatter": { id: "panel-frontmatter", kind: "panel", name: "Properties", panel: "frontmatter" },
  "panel-tools": { id: "panel-tools", kind: "panel", name: "Tools", panel: "tools" },
  "tab-note": { content: "Note", id: "tab-note", kind: "card", name: "Note", path: "CardFolder/Note.md" }
};

describe("appShellModel", () => {
  it("returns registered cardbooks with an active cardbook fallback", () => {
    const activeCardbook = { id: "ws-1", name: "Notes", path: "/tmp/Notes" };
    const cardbookState: CardbookState = {
      activeCardbook,
      cardTree: [],
      pinnedPaths: [],
      cardbooks: []
    };

    expect(registeredCardbooksForState(null)).toEqual([]);
    expect(registeredCardbooksForState(cardbookState)).toEqual([activeCardbook]);
    expect(registeredCardbooksForState({
      ...cardbookState,
      cardbooks: [{ id: "ws-2", name: "Work", path: "/tmp/Work" }]
    })).toEqual([{ id: "ws-2", name: "Work", path: "/tmp/Work" }]);
  });

  it("collects open card paths and panel tab ids", () => {
    expect(openCardPathsForTabs(tabs)).toEqual(new Set(["CardFolder/Note.md"]));
    expect(openPanelTabIdsForTabs(tabs)).toEqual(new Set(["calendar-settings", "frontmatter", "tools"]));
  });

  it("detects active panel and chart tabs from panes", () => {
    expect(activePanelTabIdsForPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("timeline-charts"),
      tabs
    )).toEqual(new Set(["frontmatter"]));
    expect(isChartTabOpenInTabs(tabs)).toBe(true);
    expect(isChartTabActiveInPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("timeline-charts"),
      tabs
    )).toBe(true);
    expect(isChartTabActiveInPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("timeline-custom"),
      tabs
    )).toBe(false);
  });

  it("labels panel tabs through translations", () => {
    const labels = panelLabelsForTranslator(createTranslator("en"));

    expect(labels).toEqual({
      "calendar-settings": "Calendar Settings",
      frontmatter: "Properties",
      settings: "Settings",
      tools: "Tools"
    });
  });

  it("filters and splits rail views without changing order", () => {
    const railViews: AppRailView[] = [
      { icon: null, id: "cards", label: "Cards" },
      { icon: null, id: "tools", label: "Tools" },
      { icon: null, id: "frontmatter", label: "Properties" },
      { icon: null, id: "timeline", label: "Timeline" },
      { icon: null, id: "calendar-settings", label: "Calendar Settings" },
      { icon: null, id: "settings", label: "Settings" }
    ];

    const enabled = enabledRailViewsForFeatures(railViews, {
      ...defaultFeatureToggles,
      frontmatter: false,
      tools: false
    });
    const split = splitRailViews(enabled);

    expect(enabled.map((view) => view.id)).toEqual(["cards", "timeline", "calendar-settings", "settings"]);
    expect(split.primaryRailViews.map((view) => view.id)).toEqual(["cards"]);
    expect(split.chartRailView?.id).toBe("timeline");
    expect(split.panelRailViews.map((view) => view.id)).toEqual(["calendar-settings", "settings"]);
  });
});
