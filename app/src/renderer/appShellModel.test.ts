import { describe, expect, it } from "vitest";

import { defaultFeatureToggles, type WorkspaceState } from "../shared/ipc";
import {
  activeChartIdsForPanes,
  activePanelTabIdsForPanes,
  chartIdForRailView,
  enabledRailViewsForFeatures,
  isChartTabActiveInPanes,
  isChartTabOpenInTabs,
  openChartIdsForTabs,
  openFilePathsForTabs,
  openPanelTabIdsForTabs,
  panelLabelsForTranslator,
  registeredWorkspacesForState,
  splitRailViews,
  type AppRailView
} from "./appShellModel";
import { createTranslator } from "./i18nModel";
import type { PaneState, Tab } from "./store/editorStore";

const emptyPane = (activeTabId: string | null = null): PaneState => ({
  activeTabId,
  history: activeTabId ? [activeTabId] : [],
  tabIds: activeTabId ? [activeTabId] : []
});

const tabs: Record<string, Tab> = {
  "chart-charts": { chartId: "charts", id: "chart-charts", kind: "chart", name: "Chronicle" },
  "panel-frontmatter": { id: "panel-frontmatter", kind: "panel", name: "Frontmatter", panel: "frontmatter" },
  "panel-tools": { id: "panel-tools", kind: "panel", name: "Tools", panel: "tools" },
  "tab-note": { content: "Note", id: "tab-note", kind: "file", name: "Note", path: "Folder/Note.md", savedContent: "Note" }
};

describe("appShellModel", () => {
  it("returns registered workspaces with an active workspace fallback", () => {
    const activeWorkspace = { id: "ws-1", name: "Notes", path: "/tmp/Notes" };
    const workspaceState: WorkspaceState = {
      activeWorkspace,
      fileTree: [],
      pinnedPaths: [],
      workspaces: []
    };

    expect(registeredWorkspacesForState(null)).toEqual([]);
    expect(registeredWorkspacesForState(workspaceState)).toEqual([activeWorkspace]);
    expect(registeredWorkspacesForState({
      ...workspaceState,
      workspaces: [{ id: "ws-2", name: "Work", path: "/tmp/Work" }]
    })).toEqual([{ id: "ws-2", name: "Work", path: "/tmp/Work" }]);
  });

  it("collects open file paths and panel tab ids", () => {
    expect(openFilePathsForTabs(tabs)).toEqual(new Set(["Folder/Note.md"]));
    expect(openPanelTabIdsForTabs(tabs)).toEqual(new Set(["frontmatter", "tools"]));
  });

  it("detects active panel and chart tabs from panes", () => {
    expect(activePanelTabIdsForPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("chart-charts"),
      tabs
    )).toEqual(new Set(["frontmatter"]));
    expect(isChartTabOpenInTabs(tabs)).toBe(true);
    expect(openChartIdsForTabs(tabs)).toEqual(new Set(["charts"]));
    expect(activeChartIdsForPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("chart-charts"),
      tabs
    )).toEqual(new Set(["charts"]));
    expect(isChartTabActiveInPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("chart-charts"),
      tabs
    )).toBe(true);
    expect(isChartTabActiveInPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("panel-tools"),
      tabs
    )).toBe(false);
  });

  it("labels panel tabs through translations", () => {
    const labels = panelLabelsForTranslator(createTranslator("en"));

    expect(labels).toEqual({
      frontmatter: "Frontmatter",
      settings: "Settings",
      tools: "Tools"
    });
  });

  it("filters and splits rail views without changing order", () => {
    const railViews: AppRailView[] = [
      { icon: null, id: "files", label: "Files" },
      { icon: null, id: "tools", label: "Tools" },
      { icon: null, id: "frontmatter", label: "Frontmatter" },
      { icon: null, id: "cards", label: "Cards" },
      { icon: null, id: "graph", label: "Graph" },
      { icon: null, id: "sphere", label: "Sphere" },
      { icon: null, id: "chronicle", label: "Chronicle" },
      { icon: null, id: "settings", label: "Settings" }
    ];

    const defaultEnabled = enabledRailViewsForFeatures(railViews, defaultFeatureToggles);
    expect(defaultEnabled.map((view) => view.id)).toEqual(["files", "settings"]);

    const enabled = enabledRailViewsForFeatures(railViews, {
      ...defaultFeatureToggles,
      cards: true,
      chronicle: false,
      frontmatter: false,
      graph: true,
      sphere: true,
      tools: false
    });
    const split = splitRailViews(enabled);

    expect(enabled.map((view) => view.id)).toEqual(["files", "cards", "graph", "sphere", "settings"]);
    expect(split.primaryRailViews.map((view) => view.id)).toEqual(["files"]);
    expect(split.chartRailViews.map((view) => view.id)).toEqual(["cards", "graph", "sphere"]);
    expect(split.panelRailViews.map((view) => view.id)).toEqual(["settings"]);
    expect(chartIdForRailView("graph")).toBe("graph");
    expect(chartIdForRailView("cards")).toBe("cards");
    expect(chartIdForRailView("sphere")).toBe("sphere");
    expect(chartIdForRailView("chronicle")).toBe("chronicle");

    expect(enabledRailViewsForFeatures(railViews, {
      ...defaultFeatureToggles,
      cards: true,
      graph: false
    }).map((view) => view.id)).toEqual(["files", "cards", "settings"]);
  });
});
