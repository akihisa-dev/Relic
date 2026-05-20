import { describe, expect, it } from "vitest";

import { defaultFeatureToggles, type WorkspaceState } from "../shared/ipc";
import {
  activePanelTabIdsForPanes,
  enabledRailViewsForFeatures,
  isChartTabActiveInPanes,
  isChartTabOpenInTabs,
  openFilePathsForTabs,
  openPanelTabIdsForTabs,
  panelLabelsForTranslator,
  registeredWorkspacesForState,
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
  "gantt-charts": { chartId: "charts", id: "gantt-charts", kind: "gantt", name: "Chronicle" },
  "gantt-custom": { chartId: "custom", id: "gantt-custom", kind: "gantt", name: "Custom" },
  "panel-dashboard": { id: "panel-dashboard", kind: "panel", name: "Dashboard", panel: "dashboard" },
  "panel-tools": { id: "panel-tools", kind: "panel", name: "Tools", panel: "tools" },
  "tab-note": { content: "Note", id: "tab-note", kind: "file", name: "Note", path: "Folder/Note.md" }
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
    expect(openPanelTabIdsForTabs(tabs)).toEqual(new Set(["dashboard", "tools"]));
  });

  it("detects active panel and chart tabs from panes", () => {
    expect(activePanelTabIdsForPanes(
      emptyPane("panel-dashboard"),
      emptyPane("gantt-charts"),
      tabs
    )).toEqual(new Set(["dashboard"]));
    expect(isChartTabOpenInTabs(tabs)).toBe(true);
    expect(isChartTabActiveInPanes(
      emptyPane("panel-dashboard"),
      emptyPane("gantt-charts"),
      tabs
    )).toBe(true);
    expect(isChartTabActiveInPanes(
      emptyPane("panel-dashboard"),
      emptyPane("gantt-custom"),
      tabs
    )).toBe(false);
  });

  it("labels panel tabs through translations", () => {
    const labels = panelLabelsForTranslator(createTranslator("en"));

    expect(labels).toEqual({
      dashboard: "Dashboard",
      frontmatter: "Frontmatter",
      settings: "Settings",
      tools: "Tools"
    });
  });

  it("filters and splits rail views without changing order", () => {
    const railViews: AppRailView[] = [
      { icon: null, id: "files", label: "Files" },
      { icon: null, id: "dashboard", label: "Dashboard" },
      { icon: null, id: "tools", label: "Tools" },
      { icon: null, id: "frontmatter", label: "Frontmatter" },
      { icon: null, id: "chronicle", label: "Chronicle" },
      { icon: null, id: "settings", label: "Settings" }
    ];

    const enabled = enabledRailViewsForFeatures(railViews, {
      ...defaultFeatureToggles,
      frontmatter: false,
      tools: false
    });
    const split = splitRailViews(enabled);

    expect(enabled.map((view) => view.id)).toEqual(["files", "dashboard", "chronicle", "settings"]);
    expect(split.primaryRailViews.map((view) => view.id)).toEqual(["files", "dashboard"]);
    expect(split.chartRailView?.id).toBe("chronicle");
    expect(split.panelRailViews.map((view) => view.id)).toEqual(["settings"]);
  });
});
