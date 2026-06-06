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
  titleBarEditorLeftOffset,
  titleBarLeftOffset,
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
  "chart-date": { chartId: "date", id: "chart-date", kind: "chart", name: "Calendar" },
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
    expect(openChartIdsForTabs(tabs)).toEqual(new Set(["charts", "date"]));
    expect(activeChartIdsForPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("chart-date"),
      tabs
    )).toEqual(new Set(["date"]));
    expect(isChartTabActiveInPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("chart-charts"),
      tabs
    )).toBe(true);
    expect(isChartTabActiveInPanes(
      emptyPane("panel-frontmatter"),
      emptyPane("chart-date"),
      tabs
    )).toBe(false);
  });

  it("labels panel tabs through translations", () => {
    const labels = panelLabelsForTranslator(createTranslator("en"));

    expect(labels).toEqual({
      chronicleSettings: "Calendar Settings",
      frontmatter: "Frontmatter",
      settings: "Settings",
      tools: "Tools"
    });
  });

  it("keeps title bar tabs aligned to the visible main editor edge", () => {
    expect(titleBarLeftOffset(88, 48, 260)).toBe(308);
    expect(titleBarLeftOffset(88, 48, 20)).toBe(88);
    expect(titleBarLeftOffset(88, 56, 260, 0, 0)).toBe(316);
    expect(titleBarLeftOffset(88, 56, 260, 0, 0, 400)).toBe(716);
  });

  it("keeps the split tab lanes aligned to the editor surface including the line-number gutter", () => {
    expect(titleBarEditorLeftOffset(56, 0)).toBe(56);
    expect(titleBarEditorLeftOffset(56, 260)).toBe(316);
    expect(titleBarEditorLeftOffset(56, 260, 0, 0, 400)).toBe(716);
  });

  it("filters and splits rail views without changing order", () => {
    const railViews: AppRailView[] = [
      { icon: null, id: "files", label: "Files" },
      { icon: null, id: "tools", label: "Tools" },
      { icon: null, id: "frontmatter", label: "Frontmatter" },
      { icon: null, id: "chronicle", label: "Timeline" },
      { icon: null, id: "calendar", label: "Calendar" },
      { icon: null, id: "chronicleSettings", label: "Calendar Settings" },
      { icon: null, id: "settings", label: "Settings" }
    ];

    const defaultEnabled = enabledRailViewsForFeatures(railViews, defaultFeatureToggles);
    expect(defaultEnabled.map((view) => view.id)).toEqual(["files", "calendar", "settings"]);

    const enabled = enabledRailViewsForFeatures(railViews, {
      ...defaultFeatureToggles,
      calendar: false,
      chronicle: false,
      chronicleSettings: false,
      frontmatter: false,
      tools: false
    });
    const split = splitRailViews(enabled);

    expect(enabled.map((view) => view.id)).toEqual(["files", "settings"]);
    expect(split.primaryRailViews.map((view) => view.id)).toEqual(["files"]);
    expect(split.chartRailViews.map((view) => view.id)).toEqual([]);
    expect(split.panelRailViews.map((view) => view.id)).toEqual(["settings"]);
    expect(chartIdForRailView("chronicle")).toBe("chronicle");
    expect(chartIdForRailView("calendar")).toBe("date");
  });
});
