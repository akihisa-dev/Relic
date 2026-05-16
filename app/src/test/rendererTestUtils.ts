import { vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  type WorkspaceState
} from "../shared/ipc";
import { useEditorStore } from "../renderer/store/editorStore";
import { useGraphStore } from "../renderer/store/graphStore";
import { useUiStore } from "../renderer/store/uiStore";

export const testWorkspaceState: WorkspaceState = {
  activeWorkspace: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
  fileTree: [],
  pinnedPaths: [],
  workspaces: []
};

export function installMatchMediaMock(): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  });
}

export function resetRendererStores(): void {
  useEditorStore.setState({
    focusedPane: "left",
    isSplit: false,
    leftPane: { activeTabId: null, history: [], tabIds: [] },
    rightPane: { activeTabId: null, history: [], tabIds: [] },
    tabs: {}
  });
  useGraphStore.setState({
    centerForce: 1,
    error: null,
    folderFilter: "",
    graph: null,
    groups: [],
    isLoading: false,
    linkDistance: 118,
    linkFilter: "all",
    linkForce: 1,
    linkThickness: 1,
    loadedWorkspaceId: null,
    localGraphDepth: 0,
    minDegree: 0,
    nodeSize: 1,
    query: "",
    repelForce: 1,
    selectedPath: null,
    showArrows: false,
    showLabels: true,
    showOrphans: true,
    tagFilter: "",
    textFadeThreshold: 0.85,
    zoom: 1
  });
  useUiStore.setState({
    activeSidebarView: "files",
    isRightPanelOpen: true,
    isSidebarOpen: true,
    isTypewriterMode: false,
    rightPanelView: "outline",
    selectedGanttChartId: null
  });
}

export function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  return {
    applySearchAndReplace: vi.fn(),
    createFolder: vi.fn(),
    createLinkedMarkdownFile: vi.fn(),
    createMarkdownFile: vi.fn(),
    createNewWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    duplicateMarkdownFile: vi.fn(),
    generateTableOfContents: vi.fn(),
    generateTitleList: vi.fn(),
    getAppInfo: vi.fn().mockResolvedValue({ ok: true, value: { name: "Relic", platform: "darwin", version: "0.0.0" } }),
    getBacklinks: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultEditorSettings, language: "ja" } }),
    getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: defaultFeatureToggles }),
    getFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getFrontmatterValueCandidates: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceAliases: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getWorkspaceChronicle: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceGraph: vi.fn().mockResolvedValue({ ok: true, value: { edges: [], nodes: [] } }),
    getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    getWorkspaceTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    mergeFiles: vi.fn().mockResolvedValue({ ok: true, value: "merged.md" }),
    moveFolder: vi.fn(),
    moveItemToTrash: vi.fn(),
    moveMarkdownFile: vi.fn(),
    openWorkspace: vi.fn(),
    readClipboardText: vi.fn().mockReturnValue(""),
    readMarkdownFile: vi.fn(),
    removeWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    renameFolder: vi.fn(),
    renameMarkdownFile: vi.fn(),
    renameWorkspace: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeWorkspace: { id: "ws-1", name: "Renamed", path: "/tmp/Renamed" },
        fileTree: [],
        pinnedPaths: [],
        workspaces: [{ id: "ws-1", name: "Renamed", path: "/tmp/Renamed" }]
      }
    }),
    replaceInFile: vi.fn(),
    revealWorkspaceItem: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveWorkspaceGanttCharts: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    searchAndReplace: vi.fn(),
    searchWorkspace: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    splitFileByHeading: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    switchWorkspace: vi.fn(),
    togglePin: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    updateGanttChartEntry: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    writeClipboardText: vi.fn(),
    writeMarkdownFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  } as typeof window.relic;
}
