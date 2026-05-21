import { vi } from "vitest";

import {
  defaultEditorSettings,
  defaultFeatureToggles,
  type CardbookState
} from "../shared/ipc";
import { useEditorStore } from "../renderer/store/editorStore";
import { useUiStore } from "../renderer/store/uiStore";

export const testCardbookState: CardbookState = {
  activeCardbook: { id: "ws-1", name: "Notes", path: "/tmp/Notes" },
  cardTree: [],
  pinnedPaths: [],
  cardbooks: []
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
    activeSidebarView: "cards",
    isRightPanelOpen: false,
    isSidebarOpen: true,
    isTypewriterMode: false,
    rightPanelView: "outline",
    selectedTimelineChartId: null
  });
}

export function makeRelicApi(overrides: Partial<typeof window.relic> = {}): typeof window.relic {
  return {
    applySearchAndReplace: vi.fn(),
    createCardFolder: vi.fn(),
    createLinkedMarkdownCard: vi.fn(),
    createMarkdownCard: vi.fn(),
    createNewCardbook: vi.fn().mockResolvedValue({ ok: true, value: { activeCardbook: null, cardTree: [], pinnedPaths: [], cardbooks: [] } }),
    duplicateMarkdownCard: vi.fn(),
    generateTableOfContents: vi.fn(),
    generateTitleList: vi.fn(),
    getAppInfo: vi.fn().mockResolvedValue({ ok: true, value: { name: "Relic", platform: "darwin", version: "0.0.0" } }),
    getBacklinks: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: { ...defaultEditorSettings, language: "ja" } }),
    getFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: defaultFeatureToggles }),
    getFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getFrontmatterValueCandidates: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getCardbookAliases: vi.fn().mockResolvedValue({ ok: true, value: {} }),
    getCardbookTimeline: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    getCardbookState: vi.fn().mockResolvedValue({ ok: true, value: { activeCardbook: null, cardTree: [], pinnedPaths: [], cardbooks: [] } }),
    getCardbookTags: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    mergeCards: vi.fn().mockResolvedValue({ ok: true, value: "merged.md" }),
    moveCardFolder: vi.fn(),
    moveItemToTrash: vi.fn(),
    moveMarkdownCard: vi.fn(),
    onCardbookChanged: vi.fn().mockReturnValue(vi.fn()),
    openCardbook: vi.fn(),
    readClipboardText: vi.fn().mockReturnValue(""),
    readMarkdownCard: vi.fn(),
    removeCardbook: vi.fn().mockResolvedValue({ ok: true, value: { activeCardbook: null, cardTree: [], pinnedPaths: [], cardbooks: [] } }),
    renameCardFolder: vi.fn(),
    renameMarkdownCard: vi.fn(),
    renameCardbook: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        activeCardbook: { id: "ws-1", name: "Renamed", path: "/tmp/Renamed" },
        cardTree: [],
        pinnedPaths: [],
        cardbooks: [{ id: "ws-1", name: "Renamed", path: "/tmp/Renamed" }]
      }
    }),
    replaceInCard: vi.fn(),
    revealCardbookItem: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveEditorSettings: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFeatureToggles: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveFrontmatterTemplates: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveUserDefinedFields: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    saveCardbookTimelineCharts: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    searchAndReplace: vi.fn(),
    searchCardbook: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    splitCardByHeading: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    switchCardbook: vi.fn(),
    togglePin: vi.fn().mockResolvedValue({ ok: true, value: { activeCardbook: null, cardTree: [], pinnedPaths: [], cardbooks: [] } }),
    updateTimelineChartEntry: vi.fn().mockResolvedValue({ ok: true, value: [] }),
    writeClipboardText: vi.fn(),
    writeMarkdownCard: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    ...overrides
  } as typeof window.relic;
}
