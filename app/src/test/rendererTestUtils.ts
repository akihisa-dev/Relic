import { vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  type WorkspaceState
} from "../shared/ipc";
import { useEditorStore } from "../renderer/store/editorStore";
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
  useUiStore.setState({
    activeSidebarView: "files",
    isRightPanelOpen: false,
    isSidebarOpen: true,
    isTypewriterMode: false,
    rightPanelView: "outline",
    selectedChartId: null
  });
}

export function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  return {
    applySearchAndReplace: vi.fn(),
    applyAIWorkspaceOperations: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        codexAppServerAvailable: false,
        history: [],
        index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
        operationHistory: [],
        pendingOperations: []
      }
    }),
    copyDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "copied" } }),
    createFolder: vi.fn(),
    createLinkedMarkdownFile: vi.fn(),
    createMarkdownFile: vi.fn(),
    createNewWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    duplicateMarkdownFile: vi.fn(),
    discardAIWorkspaceOperations: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        codexAppServerAvailable: false,
        history: [],
        index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
        operationHistory: [],
        pendingOperations: []
      }
    }),
    generateTableOfContents: vi.fn(),
    generateTitleList: vi.fn(),
    getAppInfo: vi.fn().mockResolvedValue({ ok: true, value: { name: "Relic", platform: "darwin", version: "0.0.0" } }),
    getBacklinks: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultEditorSettings, language: "ja" } }),
    getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: defaultFeatureToggles }),
    getFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getFrontmatterValueCandidates: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getLinkUpdateImpact: vi.fn().mockResolvedValue({ ok: true, value: { fileCount: 0, linkCount: 0 } }),
    getUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceAliases: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getWorkspaceCharts: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getWorkspaceChronicleCalendars: vi.fn().mockResolvedValue({ ok: true, value: [{ id: "chronicle0", name: "メイン暦" }] }),
    getWorkspaceState: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    getWorkspaceTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getAIWorkspaceState: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        codexAppServerAvailable: false,
        history: [],
        index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
        operationHistory: [],
        pendingOperations: []
      }
    }),
    mergeFiles: vi.fn().mockResolvedValue({ ok: true, value: "merged.md" }),
    moveFolder: vi.fn(),
    moveItemToTrash: vi.fn(),
    moveMarkdownFile: vi.fn(),
    onWindowCloseRequested: vi.fn().mockReturnValue(vi.fn()),
    onWorkspaceChanged: vi.fn().mockReturnValue(vi.fn()),
    openWorkspace: vi.fn(),
    readClipboardText: vi.fn().mockReturnValue(""),
    readMarkdownFile: vi.fn(),
    removeWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    rebuildAIWorkspaceIndex: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        codexAppServerAvailable: false,
        history: [],
        index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
        operationHistory: [],
        pendingOperations: []
      }
    }),
    previewAIWorkspaceMessage: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        message: "test",
        references: [],
        requiresExternalAI: true,
        skippedLargeFiles: [],
        unreadableFiles: []
      }
    }),
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
    printPreview: vi.fn().mockResolvedValue({ ok: true, value: { status: "printed" } }),
    respondToWindowCloseRequest: vi.fn(),
    revealWorkspaceItem: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveDiagramSvg: vi.fn().mockResolvedValue({ ok: true, value: { status: "saved" } }),
    saveFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    savePreviewAsPdf: vi.fn().mockResolvedValue({ ok: true, value: { status: "saved" } }),
    saveUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveWorkspaceChronicleCalendars: vi.fn().mockResolvedValue({ ok: true, value: [{ id: "chronicle0", name: "メイン暦" }] }),
    saveWorkspaceCharts: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    searchAndReplace: vi.fn(),
    searchWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { results: [], skippedLargeFiles: 0, truncated: false } }),
    sendAIWorkspaceMessage: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        codexAppServerAvailable: false,
        history: [],
        index: { chunkCount: 0, indexedAt: null, indexedFileCount: 0, skippedLargeFiles: [], unreadableFiles: [] },
        operationHistory: [],
        pendingOperations: []
      }
    }),
    splitFileByHeading: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    switchWorkspace: vi.fn(),
    togglePin: vi.fn().mockResolvedValue({ ok: true, value: { activeWorkspace: null, fileTree: [], pinnedPaths: [], workspaces: [] } }),
    updateChartEntry: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    writeClipboardText: vi.fn(),
    writeMarkdownFile: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  } as typeof window.relic;
}
