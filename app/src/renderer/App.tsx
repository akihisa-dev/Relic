import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactElement, ReactNode } from "react";

import type {
  UpdateGanttChartEntryInput,
  WorkspaceGanttChart,
  WorkspaceState,
  WorkspaceTreeNode
} from "../shared/ipc";
import { resolveWikiLinks, type AliasIndex } from "../shared/links";
import { CommandPalette } from "./components/CommandPalette";
import { GanttChartView } from "./components/ChronicleSidebar";
import { DashboardPanel } from "./components/DashboardPanel";
import { FilesSidebar } from "./components/FilesSidebar";
import { FrontmatterSidebar } from "./components/FrontmatterSidebar";
import { GraphPanel } from "./components/GraphSidebar";
import { PaneView } from "./components/PaneView";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { ToolsSidebar } from "./components/ToolsSidebar";
import { Toolbar } from "./components/Toolbar";
import { fixedMenuPosition, IconFiles, RailWorkspaceSwitcher, sidebarViewDefs } from "./components/RailNavigation";
import { extractOutlineHeadings, getActiveFileTabInPane, getActiveTabInPane } from "./editorDerivedState";
import { normalizeWorkspaceGanttCharts, normalizeWorkspaceGanttChartsWithFiles, updateGanttChartEntryFallback } from "./ganttChartData";
import { createTranslator, I18nProvider, useT } from "./i18n";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTheme } from "./hooks/useAppTheme";
import { useBacklinksState } from "./hooks/useBacklinksState";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { usePaneTabMotion } from "./hooks/usePaneTabMotion";
import { useRailFlights } from "./hooks/useRailFlights";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useSplitCloseMotion } from "./hooks/useSplitCloseMotion";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore, type PaneId, type PanelTabKind } from "./store/editorStore";
import { useUiStore, type RightPanelView, type SidebarView } from "./store/uiStore";
import { collectMarkdownPaths, displayNameFromPath, joinWorkspacePath } from "./workspacePaths";
import "./styles.css";

// ────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────

function ensureMarkdownExtension(name: string): string {
  return name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
}

function markdownLinkForPath(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [aliasesByPath, setAliasesByPath] = useState<AliasIndex>({});
  const [ganttCharts, setGanttCharts] = useState<WorkspaceGanttChart[]>([]);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "error" | "info" } | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{
    heading?: string;
    markdownLink: string;
    openKind: "file" | "wiki";
    path: string;
    target?: string;
    x: number;
    y: number;
  } | null>(null);
  const [isToastClosing, setIsToastClosing] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeToast = useCallback(() => {
    if (!toastMessage || isToastClosing) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastCloseTimerRef.current) clearTimeout(toastCloseTimerRef.current);
    setIsToastClosing(true);
    toastCloseTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      setIsToastClosing(false);
      toastCloseTimerRef.current = null;
    }, 170);
  }, [isToastClosing, toastMessage]);
  const showToast = useCallback((text: string, type: "error" | "info" = "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastCloseTimerRef.current) clearTimeout(toastCloseTimerRef.current);
    setIsToastClosing(false);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setIsToastClosing(true);
      toastCloseTimerRef.current = setTimeout(() => {
        setToastMessage(null);
        setIsToastClosing(false);
        toastCloseTimerRef.current = null;
      }, 170);
    }, 4000);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastCloseTimerRef.current) clearTimeout(toastCloseTimerRef.current);
    };
  }, []);
  const setWorkspaceError = useCallback((msg: string | null) => {
    if (msg) showToast(msg, "error");
  }, [showToast]);
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<string | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<string | undefined>(undefined);
  const [editorActionPulse, setEditorActionPulse] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const {
    clearRailTabFlight,
    railTabFlight,
    showRailTabFlight,
    showSidebarCreateFlight,
    sidebarCreateFlight
  } = useRailFlights();
  const [fileSearchFocusRequest, setFileSearchFocusRequest] = useState(0);
  const pendingSidebarFileOpenTokensRef = useRef<Record<string, number>>({});
  const sidebarFileOpenTokenRef = useRef(0);
  const [fileSelectionCount, setFileSelectionCount] = useState(0);
  const [isWorkspaceRenameActive, setIsWorkspaceRenameActive] = useState(false);
  const [isWorkspaceRenameHoldingRail, setIsWorkspaceRenameHoldingRail] = useState(false);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const workspaceRenameHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    editorSettings,
    focusedPane,
    isSplit,
    leftPane,
    rightPane,
    tabs,
    closeAllTabs,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabsInPane,
    moveTab,
    openFileInPane,
    openGanttChartInPane,
    openPanelInPane,
    setEditorSettings,
    setFocusedPane,
    setTabActive,
    toggleSplit,
    updateTabContent,
    updateTabMeta
  } = useEditorStore();

  const {
    activeSidebarView,
    isRightPanelOpen,
    isSidebarOpen,
    isTypewriterMode,
    rightPanelView,
    setRightPanelView,
    setSidebarView,
    closeSidebar,
    toggleRightPanel,
    toggleSidebar: toggleSidebarState,
    toggleTypewriterMode
  } = useUiStore();
  const hasOpenGanttChart = useMemo(
    () => Object.values(tabs).some((tab) => tab.kind === "gantt"),
    [tabs]
  );
  const { isSplitClosing, toggleSplitWithMotion } = useSplitCloseMotion(isSplit, toggleSplit);
  const {
    closeAllTabsInPaneWithMotion,
    closeOtherTabsWithMotion,
    closeTabWithMotion,
    closeTabsToRightWithMotion,
    leftClosingTabIds,
    rightClosingTabIds
  } = usePaneTabMotion({
    closeAllTabsInPane,
    closeOtherTabs,
    closeTab,
    closeTabsToRight,
    leftPane,
    rightPane,
    showRailTabFlight,
    tabs
  });

  const toggleSidebar = useCallback((): void => {
    if (isWorkspaceRenameActive) return;
    toggleSidebarState();
  }, [isWorkspaceRenameActive, toggleSidebarState]);

  const holdWorkspaceRailAfterRename = useCallback((): void => {
    if (workspaceRenameHoldTimerRef.current) clearTimeout(workspaceRenameHoldTimerRef.current);
    setIsWorkspaceRenameHoldingRail(true);
    workspaceRenameHoldTimerRef.current = setTimeout(() => {
      setIsWorkspaceRenameHoldingRail(false);
      workspaceRenameHoldTimerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => {
    return () => {
      if (workspaceRenameHoldTimerRef.current) clearTimeout(workspaceRenameHoldTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!linkContextMenu) return;
    const close = (): void => setLinkContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [linkContextMenu]);

  const t = useMemo(() => createTranslator(editorSettings.language), [editorSettings.language]);
  const sidebarViews = useMemo(
    () =>
      sidebarViewDefs.map((view) => ({
        ...view,
        label: t(view.labelKey)
      })),
    [t]
  );

  const {
    appInfo,
    featureToggles,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  } = useAppSettingsState({
    setEditorSettings,
    setWorkspaceError,
    setWorkspaceState
  });

  const {
    frontmatterCandidates,
    isSearching,
    searchError,
    searchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery
  } = useWorkspaceSearchState({
    setWorkspaceError,
    userDefinedFields,
    workspaceState
  });

  const requestFileSearchFocus = useCallback((): void => {
    setSidebarView("files");
    setFileSearchFocusRequest((current) => current + 1);
  }, [setSidebarView]);

  const existingMarkdownPaths = useMemo(
    () => collectMarkdownPaths(workspaceState?.fileTree ?? []),
    [workspaceState?.fileTree]
  );

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setAliasesByPath({});
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceAliases().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setAliasesByPath(result.value);
      } else {
        setAliasesByPath({});
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  const reloadGanttCharts = useCallback(async (): Promise<void> => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGanttCharts([]);
      return;
    }

    const result = await window.relic.getWorkspaceChronicle();

    if (result.ok) {
      const normalized = hasOpenGanttChart
        ? await normalizeWorkspaceGanttChartsWithFiles(result.value, workspaceState.fileTree, window.relic.readMarkdownFile)
        : normalizeWorkspaceGanttCharts(result.value);
      setGanttCharts(normalized);
    } else {
      setGanttCharts([]);
      setWorkspaceError(result.error.message);
    }
  }, [hasOpenGanttChart, setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGanttCharts([]);
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceChronicle().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGanttCharts(normalizeWorkspaceGanttCharts(result.value));
      } else {
        setGanttCharts([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setWorkspaceError, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!hasOpenGanttChart) return;
    void reloadGanttCharts();
  }, [hasOpenGanttChart, reloadGanttCharts]);

  const {
    handleDeleteActiveFile,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateActiveFile,
    handleDuplicateTreeFile,
    handleCreateFile,
    handleCreateFolder,
    handleCreateNewWorkspace,
    handleCreateNoteFromPane,
    handleOpenFile,
    handleOpenMarkdownLink,
    handleOpenWikiLink,
    handleOpenWorkspace,
    handleRemoveWorkspace,
    handleRenameWorkspace,
    handleSwitchWorkspace,
    handleMoveActiveFile,
    handleMoveFile,
    handleMoveFolder,
    handleMoveTreeItems,
    handleRenameActiveFile,
    handleRenameTreeItem,
    handleTogglePin,
    isCreatingFile,
    isCreatingFolder,
    isCreatingWorkspace,
    isOpeningWorkspace,
    setIsCreatingFile
  } = useWorkspaceFileActions({
    aliasesByPath,
    closeAllTabs,
    closeTab,
    existingMarkdownPaths,
    focusedPane,
    leftPane,
    openFileInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState,
    tabs,
    updateTabMeta,
    workspaceState
  });

  const handleSidebarOpenFile = useCallback((path: string, event?: MouseEvent<HTMLButtonElement>): void => {
    if (!event) {
      handleOpenFile(path);
      return;
    }

    const rowRect = event.currentTarget.getBoundingClientRect();
    const editorState = useEditorStore.getState();
    const targetPane = editorState.focusedPane;
    const paneState = targetPane === "left" ? editorState.leftPane : editorState.rightPane;
    const tabBar = document.querySelector(`.pane${targetPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
    const tabBarRect = tabBar?.getBoundingClientRect();
    const pendingToken = pendingSidebarFileOpenTokensRef.current[path];

    if (pendingToken) {
      delete pendingSidebarFileOpenTokensRef.current[path];
      showRailTabFlight({
        direction: "close",
        fromX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
        fromY: (tabBarRect?.top ?? rowRect.top) + 15,
        label: displayNameFromPath(path),
        toX: rowRect.left + rowRect.width / 2,
        toY: rowRect.top + rowRect.height / 2
      });
      return;
    }

    const openTabIdInPane = paneState.tabIds.find((tabId) => {
      const tab = editorState.tabs[tabId];
      return tab?.kind === "file" && tab.path === path;
    });
    const openTabInPane = openTabIdInPane ? editorState.tabs[openTabIdInPane] : null;

    if (openTabIdInPane && openTabInPane?.kind === "file") {
      setTabActive(targetPane, openTabIdInPane);
      return;
    }

    const existingTab = Object.values(editorState.tabs).find((tab) => tab.kind === "file" && tab.path === path);
    const label = existingTab?.name ?? displayNameFromPath(path);

    showRailTabFlight({
      direction: "open",
      fromX: rowRect.left + rowRect.width / 2,
      fromY: rowRect.top + rowRect.height / 2,
      label,
      toX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
      toY: (tabBarRect?.top ?? rowRect.top) + 15
    });

    if (existingTab?.kind === "file") {
      openFileInPane(targetPane, { content: existingTab.content, name: existingTab.name, path: existingTab.path });
      return;
    }

    if (!window.relic) return;

    setWorkspaceError(null);
    const token = sidebarFileOpenTokenRef.current + 1;
    sidebarFileOpenTokenRef.current = token;
    pendingSidebarFileOpenTokensRef.current[path] = token;
    void window.relic.readMarkdownFile({ path }).then((result) => {
      if (pendingSidebarFileOpenTokensRef.current[path] !== token) return;
      delete pendingSidebarFileOpenTokensRef.current[path];
      if (result.ok) {
        openFileInPane(targetPane, result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [handleOpenFile, openFileInPane, setTabActive, setWorkspaceError, showRailTabFlight]);

  const renderPanelTabIcon = useCallback((panel: PanelTabKind): ReactNode => (
    sidebarViews.find((view) => view.id === panel)?.icon ?? null
  ), [sidebarViews]);

  const handleUpdateGanttChartEntry = useCallback(async (input: UpdateGanttChartEntryInput): Promise<void> => {
    if (!window.relic) return;

    const relic = window.relic;
    const updateEntry = (relic as Partial<typeof relic>).updateGanttChartEntry;
    const result = typeof updateEntry === "function"
      ? await updateEntry(input).catch(() => updateGanttChartEntryFallback(input, relic))
      : await updateGanttChartEntryFallback(input, relic);

    if (result.ok) {
      setGanttCharts(await normalizeWorkspaceGanttChartsWithFiles(result.value, workspaceState?.fileTree ?? [], relic.readMarkdownFile));
      const updatedFile = await relic.readMarkdownFile({ path: input.path });

      if (updatedFile.ok) {
        Object.values(tabs).forEach((tab) => {
          if (tab.kind === "file" && tab.path === input.path) {
            updateTabContent(tab.id, updatedFile.value.content);
          }
        });
      }
    } else {
      setWorkspaceError(result.error.message);
    }
  }, [setWorkspaceError, tabs, updateTabContent]);

  const renderGanttChartTab = useCallback((chartId: string): ReactNode => (
    <GanttChartView
      chart={chartId === "charts" ? null : ganttCharts.find((chart) => chart.id === chartId) ?? null}
      charts={chartId === "charts" ? ganttCharts : undefined}
      onOpenFile={handleOpenFile}
      onUpdateEntry={handleUpdateGanttChartEntry}
    />
  ), [ganttCharts, handleOpenFile, handleUpdateGanttChartEntry]);

  const handleFileSaved = useCallback((): void => {
    void reloadGanttCharts();
  }, [reloadGanttCharts]);

  const handleCreateFileFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tabBar = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const tabBarRect = tabBar?.getBoundingClientRect();

      showRailTabFlight({
        direction: "open",
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("files.createNote"),
        toX: (tabBarRect?.left ?? buttonRect.left + buttonRect.width + 120) + 48,
        toY: (tabBarRect?.top ?? buttonRect.top) + 15
      });
    }

    handleCreateFile();
  }, [focusedPane, handleCreateFile, showRailTabFlight, t]);

  const handleCreateFolderFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tree = document.querySelector(".sidebar-view-content--files .file-tree");
      const treeRect = tree?.getBoundingClientRect();

      showSidebarCreateFlight({
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("files.createFolder"),
        toX: (treeRect?.left ?? buttonRect.left) + 24,
        toY: (treeRect?.top ?? buttonRect.top + 72) + 14
      });
    }

    handleCreateFolder();
  }, [handleCreateFolder, showSidebarCreateFlight, t]);

  useAppTheme(editorSettings.theme);

  useAppKeyboardShortcuts({
    closeTab: closeTabWithMotion,
    focusedPane,
    leftPane,
    requestFileSearchFocus,
    rightPane,
    setIsCreatingFile,
    setShowCommandPalette,
    setShowQuickSwitcher,
    setSidebarView,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit: toggleSplitWithMotion,
    toggleTypewriterMode
  });

  const { sidebarWidth, isSidebarResizing, startSidebarResize } = useSidebarResize({
    initialWidth: 260,
    maxWidth: 500,
    minWidth: 180
  });

  const leftEditorViewRef = useRef<EditorView | null>(null);
  const rightEditorViewRef = useRef<EditorView | null>(null);

  const handleRightPanelViewButton = useCallback((view: RightPanelView): void => {
    if (isRightPanelOpen && rightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [isRightPanelOpen, rightPanelView, setRightPanelView, toggleRightPanel]);

  const openFileInOtherPane = useCallback((fromPane: PaneId, tabId: string) => {
    const tab = tabs[tabId];
    if (!tab || !isSplit) return;
    const otherPane = fromPane === "left" ? "right" : "left";
    if (tab.kind === "file") {
      openFileInPane(otherPane, { content: tab.content, name: tab.name, path: tab.path });
    } else if (tab.kind === "panel") {
      openPanelInPane(otherPane, tab.panel, tab.name);
    } else {
      openGanttChartInPane(otherPane, { id: tab.chartId, name: tab.name });
    }
  }, [tabs, isSplit, openFileInPane, openGanttChartInPane, openPanelInPane]);

  const openTreeFileInOtherPane = useCallback((path: string): void => {
    if (!window.relic || !isSplit) return;
    const otherPane = focusedPane === "left" ? "right" : "left";

    void window.relic.readMarkdownFile({ path }).then((result) => {
      if (result.ok) {
        openFileInPane(otherPane, result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, isSplit, openFileInPane, setWorkspaceError]);

  const openWorkspacePathInOtherPane = useCallback((path: string, heading?: string): void => {
    if (!window.relic || !isSplit) return;
    const otherPane = focusedPane === "left" ? "right" : "left";
    const setScrollHeading = otherPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

    void window.relic.readMarkdownFile({ path }).then((readResult) => {
      if (readResult.ok) {
        openFileInPane(otherPane, readResult.value);
        if (heading) setScrollHeading(heading);
        return;
      }

      void window.relic!.createLinkedMarkdownFile({ path }).then((createResult) => {
        if (createResult.ok) {
          setWorkspaceState(createResult.value.workspaceState);
          openFileInPane(otherPane, createResult.value.file);
          if (heading) setScrollHeading(heading);
        } else {
          setWorkspaceError(createResult.error.message);
        }
      });
    });
  }, [
    focusedPane,
    isSplit,
    openFileInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setWorkspaceError,
    setWorkspaceState
  ]);

  const handleCreateFileInFolder = useCallback((folderPath: string): void => {
    if (!window.relic) return;
    const fileName = window.prompt(t("files.newNoteName"), "Untitled.md");
    if (fileName === null) return;
    const trimmedFileName = fileName.trim();
    if (!trimmedFileName) return;

    const nextPath = joinWorkspacePath(folderPath, ensureMarkdownExtension(trimmedFileName));

    setWorkspaceError(null);
    void window.relic.createLinkedMarkdownFile({ path: nextPath }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, openFileInPane, setWorkspaceError, setWorkspaceState, t]);

  const handleCreateFolderInFolder = useCallback((folderPath: string): void => {
    if (!window.relic) return;
    const folderName = window.prompt(t("files.newFolderName"), "New Folder");
    if (folderName === null) return;
    const trimmedFolderName = folderName.trim();
    if (!trimmedFolderName) return;

    setWorkspaceError(null);
    void window.relic.createFolder({ name: trimmedFolderName, parentFolder: folderPath }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [setWorkspaceError, setWorkspaceState, t]);

  const handleRevealWorkspaceItem = useCallback((path: string): void => {
    if (!window.relic) return;

    setWorkspaceError(null);
    void window.relic.revealWorkspaceItem({ path }).then((result) => {
      if (!result.ok) setWorkspaceError(result.error.message);
    });
  }, [setWorkspaceError]);

  const handleDuplicateTabFile = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    handleDuplicateTreeFile(tab.path);
  }, [handleDuplicateTreeFile, tabs]);

  const handleRevealTabFile = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    handleRevealWorkspaceItem(tab.path);
  }, [handleRevealWorkspaceItem, tabs]);

  const handleTogglePinTab = useCallback((tabId: string): void => {
    const tab = tabs[tabId];
    if (!tab || tab.kind !== "file") return;
    handleTogglePin(tab.path);
  }, [handleTogglePin, tabs]);

  const handleSelectFolder = useCallback(
    (node: Extract<WorkspaceTreeNode, { type: "folder" }>): void => {
      void node; // フェーズ2ではフォルダ選択は何もしない
    },
    []
  );

  const registeredWorkspaces = useMemo(
    () =>
      workspaceState && workspaceState.workspaces.length > 0
        ? workspaceState.workspaces
        : workspaceState?.activeWorkspace
          ? [workspaceState.activeWorkspace]
          : [],
    [workspaceState]
  );
  const pinnedPathSet = useMemo(
    () => new Set(workspaceState?.pinnedPaths ?? []),
    [workspaceState?.pinnedPaths]
  );
  const openFilePathSet = useMemo(
    () => new Set(
      Object.values(tabs)
        .filter((tab) => tab.kind === "file")
        .map((tab) => tab.path)
    ),
    [tabs]
  );

  // ──────────────────
  // アウトライン（右パネル）
  // ──────────────────

  const activeTabInFocusedPane = getActiveTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );
  const activeFileTabInFocusedPane = getActiveFileTabInPane(
    focusedPane,
    { leftPane, rightPane },
    tabs
  );
  const activeFilePathForGraph = useMemo(() => {
    const paneOrder = focusedPane === "left" ? [leftPane, rightPane] : [rightPane, leftPane];
    for (const pane of paneOrder) {
      for (const tabId of [...pane.history].reverse()) {
        const tab = tabs[tabId];
        if (tab?.kind === "file") return tab.path;
      }
    }
    for (const tab of Object.values(tabs)) {
      if (tab.kind === "file") return tab.path;
    }
    return null;
  }, [focusedPane, leftPane, rightPane, tabs]);
  const outlineHeadings = activeFileTabInFocusedPane
    ? extractOutlineHeadings(activeFileTabInFocusedPane.content)
    : [];
  const outgoingLinks = activeFileTabInFocusedPane
    ? resolveWikiLinks(activeFileTabInFocusedPane.content, activeFileTabInFocusedPane.path, existingMarkdownPaths, aliasesByPath)
    : [];

  const { backlinks, isLoadingBacklinks } = useBacklinksState({
    activeFilePath: activeFileTabInFocusedPane?.path ?? null,
    fileTree: workspaceState?.fileTree,
    setWorkspaceError
  });

  const commands = useCommandPaletteCommands({
    activeFileName: activeFileTabInFocusedPane?.name ?? null,
    handleDeleteActiveFile,
    handleDuplicateActiveFile,
    requestFileSearchFocus,
    setIsCreatingFile,
    setShowQuickSwitcher,
    setSidebarView,
    t,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit: toggleSplitWithMotion,
    toggleTypewriterMode
  });

  const panelLabels = useMemo<Record<PanelTabKind, string>>(() => ({
    dashboard: t("nav.dashboard"),
    frontmatter: t("nav.frontmatter"),
    graph: t("nav.graph"),
    settings: t("nav.settings"),
    tools: t("nav.tools")
  }), [t]);

  const openPanelTabIds = useMemo(() => new Set(
    Object.values(tabs)
      .filter((tab) => tab.kind === "panel")
      .map((tab) => tab.panel)
  ), [tabs]);
  const activePanelTabIds = useMemo(() => new Set(
    [leftPane.activeTabId, rightPane.activeTabId]
      .map((tabId) => tabId ? tabs[tabId] : null)
      .filter((tab) => tab?.kind === "panel")
      .map((tab) => tab.panel)
  ), [leftPane.activeTabId, rightPane.activeTabId, tabs]);
  const isChartTabOpen = useMemo(
    () => Object.values(tabs).some((tab) => tab.kind === "gantt" && tab.chartId === "charts"),
    [tabs]
  );
  const isChartTabActive = useMemo(
    () => [leftPane.activeTabId, rightPane.activeTabId].some((tabId) => {
      const tab = tabId ? tabs[tabId] : null;
      return tab?.kind === "gantt" && tab.chartId === "charts";
    }),
    [leftPane.activeTabId, rightPane.activeTabId, tabs]
  );
  const enabledRailViews = useMemo(() => sidebarViews.filter((view) => {
    if (view.id === "tools" && !featureToggles.tools) return false;
    if (view.id === "frontmatter" && !featureToggles.frontmatter) return false;
    return true;
  }), [featureToggles.frontmatter, featureToggles.tools, sidebarViews]);
  const primaryRailViews = enabledRailViews.filter((view) =>
    view.id === "files" || view.id === "dashboard" || view.id === "graph"
  );
  const chartRailView = enabledRailViews.find((view) => view.id === "chronicle");
  const panelRailViews = enabledRailViews.filter((view) =>
    view.id !== "files" && view.id !== "dashboard" && view.id !== "graph" && view.id !== "chronicle"
  );

  useEffect(() => {
    if (
      activeSidebarView !== "tools" &&
      activeSidebarView !== "frontmatter" &&
      activeSidebarView !== "settings" &&
      activeSidebarView !== "graph"
    ) {
      return;
    }

    openPanelInPane(focusedPane, activeSidebarView, panelLabels[activeSidebarView]);
    setSidebarView("files");
  }, [activeSidebarView, focusedPane, openPanelInPane, panelLabels, setSidebarView]);

  const handleRailPanelButton = useCallback((panel: PanelTabKind, label: string, event: MouseEvent<HTMLButtonElement>): void => {
    const railRect = event.currentTarget.getBoundingClientRect();
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

    openPanelInPane(focusedPane, panel, label);

    requestAnimationFrame(() => {
      const pane = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const toRect = pane?.getBoundingClientRect();
      showRailTabFlight({
        direction: "open",
        fromX: railRect.left + railRect.width / 2,
        fromY: railRect.top + railRect.height / 2,
        label,
        toX: (toRect?.left ?? railRect.left + 180) + 48,
        toY: (toRect?.top ?? railRect.top) + 15
      });
    });
  }, [clearRailTabFlight, focusedPane, openPanelInPane, setTabActive, showRailTabFlight]);

  const handleRailChartButton = useCallback((label: string, event: MouseEvent<HTMLButtonElement>): void => {
    const railRect = event.currentTarget.getBoundingClientRect();
    const tabId = "gantt-charts";
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
    openGanttChartInPane(focusedPane, { id: "charts", name: label });

    requestAnimationFrame(() => {
      const pane = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const toRect = pane?.getBoundingClientRect();
      showRailTabFlight({
        direction: "open",
        fromX: railRect.left + railRect.width / 2,
        fromY: railRect.top + railRect.height / 2,
        label,
        toX: (toRect?.left ?? railRect.left + 180) + 48,
        toY: (toRect?.top ?? railRect.top) + 15
      });
    });
  }, [clearRailTabFlight, closeSidebar, focusedPane, openGanttChartInPane, setTabActive, showRailTabFlight]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "dashboard") {
      return (
        <DashboardPanel
          fileTree={workspaceState?.fileTree ?? []}
          onOpenFile={handleOpenFile}
          userDefinedFields={userDefinedFields}
          workspaceId={workspaceState?.activeWorkspace?.id ?? null}
        />
      );
    }

    if (panel === "tools") {
      return <ToolsSidebar workspacePath={workspaceState?.activeWorkspace?.path ?? null} />;
    }

    if (panel === "frontmatter") {
      return (
        <FrontmatterSidebar
          onUserDefinedFieldsSave={handleSaveUserDefinedFields}
          userDefinedFields={userDefinedFields}
        />
      );
    }

    if (panel === "graph") {
      return (
        <GraphPanel
          activeFilePath={activeFilePathForGraph}
          onOpenFile={handleOpenFile}
          workspaceId={workspaceState?.activeWorkspace?.id ?? null}
        />
      );
    }

    return (
      <SettingsSidebar
        appInfo={appInfo}
        featureToggles={featureToggles}
        onFeatureTogglesSave={handleSaveFeatureToggles}
        onSave={handleSaveSettings}
        settings={editorSettings}
      />
    );
  }, [
    activeFilePathForGraph, appInfo, editorSettings, featureToggles, handleOpenFile,
    handleSaveFeatureToggles, handleSaveSettings, handleSaveUserDefinedFields,
    userDefinedFields, workspaceState
  ]);

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className="app-shell">
      <div className="title-bar" />
      <div className="workspace">
        {/* 縦アイコンナビ（レール） */}
        <nav
          aria-label={t("nav.viewSwitcher")}
          className={`rail${isWorkspaceRenameActive || isWorkspaceRenameHoldingRail ? " rail--workspace-editing" : ""}`}
        >
          {primaryRailViews.map((view) => (
              <button
                aria-label={view.label}
                className={`rail-button${view.id === "graph" || view.id === "dashboard" ? activePanelTabIds.has(view.id as PanelTabKind) ? " active" : openPanelTabIds.has(view.id as PanelTabKind) ? " open" : "" : view.id === activeSidebarView && isSidebarOpen ? " active" : ""}`}
                key={view.id}
                onClick={(event) => {
                  if (view.id === "graph" || view.id === "dashboard") {
                    handleRailPanelButton(view.id as PanelTabKind, view.label, event);
                    return;
                  }

                  if (view.id === "files" && activeSidebarView === "files" && isSidebarOpen) {
                    closeSidebar();
                    return;
                  }

                  setSidebarView(view.id as SidebarView);
                }}
                title={view.label}
                type="button"
              >
                {view.id === "files" ? <IconFiles sidebarOpen={isSidebarOpen} /> : view.icon}
                <span className="rail-button-label">{view.label}</span>
              </button>
            ))}
          {chartRailView ? (
            <button
              aria-label={chartRailView.label}
              className={`rail-button${isChartTabActive ? " active" : isChartTabOpen ? " open" : ""}`}
              onClick={(event) => handleRailChartButton(chartRailView.label, event)}
              title={chartRailView.label}
              type="button"
            >
              {chartRailView.icon}
              <span className="rail-button-label">{chartRailView.label}</span>
            </button>
          ) : null}
          <div className="rail-separator" />
          {panelRailViews.map((view) => (
            <button
              aria-label={view.label}
              className={`rail-button${activePanelTabIds.has(view.id as PanelTabKind) ? " active" : openPanelTabIds.has(view.id as PanelTabKind) ? " open" : ""}`}
              key={view.id}
              onClick={(event) => handleRailPanelButton(view.id as PanelTabKind, view.label, event)}
              title={view.label}
              type="button"
            >
              {view.icon}
              <span className="rail-button-label">{view.label}</span>
            </button>
          ))}
          {registeredWorkspaces.length > 0 ? (
            <>
              <div className="rail-spacer" />
              <div className="rail-separator" />
              <RailWorkspaceSwitcher
                activeWorkspaceId={workspaceState?.activeWorkspace?.id ?? null}
                ariaLabel={t("files.registeredWorkspaces")}
                onRenameActiveChange={setIsWorkspaceRenameActive}
                onRenameComplete={holdWorkspaceRailAfterRename}
                onRemoveWorkspace={handleRemoveWorkspace}
                onRenameWorkspace={handleRenameWorkspace}
                onSwitchWorkspace={handleSwitchWorkspace}
                renameLabel={t("files.rename")}
                removeLabel={(name) => t("files.removeWorkspace", { name })}
                workspaces={registeredWorkspaces}
              />
            </>
          ) : null}
        </nav>

        {/* サイドバー */}
          <aside
            aria-hidden={!isSidebarOpen}
            className={`sidebar${isSidebarOpen ? "" : " sidebar--closed"}${isSidebarResizing ? " sidebar--resizing" : ""}`}
            style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
          >
              <div className="sidebar-header">
                <div className="pane-heading">
                  {sidebarViews.find((v) => v.id === activeSidebarView)?.label}
                  {activeSidebarView === "files" && fileSelectionCount > 1 ? (
                    <span className="pane-heading-count">
                      {t("files.selectedCount", { count: fileSelectionCount })}
                    </span>
                  ) : null}
                </div>
              </div>
            <div className={`sidebar-body sidebar-view-content sidebar-view-content--${activeSidebarView}`}>
            {activeSidebarView === "files" ? (
              <FilesSidebar
                isCreatingFile={isCreatingFile}
                isCreatingFolder={isCreatingFolder}
                isCreatingWorkspace={isCreatingWorkspace}
                isSearching={isSearching}
                isOpeningWorkspace={isOpeningWorkspace}
                onCreateFile={handleCreateFileFromSidebar}
                onCreateFileInFolder={handleCreateFileInFolder}
                onCreateFolder={handleCreateFolderFromSidebar}
                onCreateFolderInFolder={handleCreateFolderInFolder}
                onCreateWorkspace={handleCreateNewWorkspace}
                onDeleteItem={handleDeleteTreeItem}
                onDeleteItems={handleDeleteTreeItems}
                onDuplicateFile={handleDuplicateTreeFile}
                onMoveFile={handleMoveFile}
                onMoveFolder={handleMoveFolder}
                onMoveItems={handleMoveTreeItems}
                onOpenFile={handleSidebarOpenFile}
                onOpenInOtherPane={isSplit ? openTreeFileInOtherPane : undefined}
                onOpenWorkspace={handleOpenWorkspace}
                onRevealItem={handleRevealWorkspaceItem}
                onRenameItem={handleRenameTreeItem}
                onSelectFolder={handleSelectFolder}
                onSelectedCountChange={setFileSelectionCount}
                onSearchFrontmatterFieldChange={setSearchFrontmatterField}
                onSearchModeChange={setSearchMode}
                onSearchQueryChange={setSearchQuery}
                onTogglePin={handleTogglePin}
                openFilePaths={openFilePathSet}
                searchError={searchError}
                searchFocusRequest={fileSearchFocusRequest}
                searchFrontmatterCandidates={frontmatterCandidates}
                searchFrontmatterField={searchFrontmatterField}
                searchMode={searchMode}
                searchQuery={searchQuery}
                searchResults={searchResults}
                workspaceState={workspaceState}
              />
            ) : null}
            </div>
            <div
              className={`sidebar-resize-handle${isSidebarResizing ? " sidebar-resize-handle--active" : ""}`}
              onMouseDown={startSidebarResize}
            />
          </aside>

        {/* メインエリア */}
        <main className="main-area">
          <div className="main-area-top-bar">
            {activeFileTabInFocusedPane ? (
              <>
                <RenameBar
                  name={activeFileTabInFocusedPane.name}
                  onRename={handleRenameActiveFile}
                />
                <MoveBar onMove={handleMoveActiveFile} />
              </>
            ) : null}
            <div className="main-area-top-actions">
              <button
                className={`toolbar-btn${isSourceMode ? " active" : ""}`}
                onClick={() => setIsSourceMode((value) => !value)}
                title={t("pane.sourceMode")}
                type="button"
              >
                {t("pane.sourceShort")}
              </button>
              <button
                className={`toolbar-btn${isSplit ? " active" : ""}`}
                onClick={toggleSplitWithMotion}
                title={t("pane.split")}
                type="button"
              >
                {t("pane.splitShort")}
              </button>
              {featureToggles.rightPanel && (
                <>
                  <button
                    className={`toolbar-btn${rightPanelView === "outline" && isRightPanelOpen ? " active" : ""}`}
                    onClick={() => handleRightPanelViewButton("outline")}
                    title={t("pane.toggleOutline")}
                    type="button"
                  >
                    {t("pane.outline")}
                  </button>
                  <button
                    className={`toolbar-btn${rightPanelView === "links" && isRightPanelOpen ? " active" : ""}`}
                    onClick={() => handleRightPanelViewButton("links")}
                    title={t("pane.toggleLinks")}
                    type="button"
                  >
                    {t("pane.links")}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="editor-layout">
            <div className="editor-workspace">
              <div className="shared-editor-toolbar">
                <Toolbar
                  fallbackViewRef={focusedPane === "left" ? rightEditorViewRef : leftEditorViewRef}
                  onEditorAction={() => setEditorActionPulse((value) => value + 1)}
                  viewRef={focusedPane === "left" ? leftEditorViewRef : rightEditorViewRef}
                />
              </div>
              <div className={`panes-container${isSplit ? " panes-container--split" : ""}${isSplitClosing ? " panes-container--closing-split" : ""}`}>
                <PaneView
                  allFilePaths={existingMarkdownPaths}
                  closingTabIds={leftClosingTabIds}
                  editorSettings={editorSettings}
                  focusedPane={focusedPane}
                  frontmatterCandidates={frontmatterCandidates}
                  editorActionPulse={focusedPane === "left" ? editorActionPulse : 0}
                  onCreateFile={handleCreateNoteFromPane}
                  onFocus={() => setFocusedPane("left")}
                  onFileSaved={handleFileSaved}
                  onOpenLink={handleOpenMarkdownLink}
                  onOpenWikiLink={handleOpenWikiLink}
                  onScrollTargetHandled={() => setLeftPaneScrollHeading(undefined)}
                  onTabClose={(tabId) => closeTabWithMotion("left", tabId)}
                  onTabMove={moveTab}
                  onTabSelect={(tabId) => setTabActive("left", tabId)}
                  onCloseOtherTabs={(tabId) => closeOtherTabsWithMotion("left", tabId)}
                  onCloseTabsToRight={(tabId) => closeTabsToRightWithMotion("left", tabId)}
                  onCloseAllTabs={() => closeAllTabsInPaneWithMotion("left")}
                  onDuplicateTabFile={handleDuplicateTabFile}
                  onOpenInOtherPane={(tabId) => openFileInOtherPane("left", tabId)}
                  onRevealTabFile={handleRevealTabFile}
                  onTogglePinTab={handleTogglePinTab}
                  pinnedPaths={pinnedPathSet}
                  isSplitView={isSplit}
                  pane="left"
                  renderGanttChartTab={renderGanttChartTab}
                  renderPanelTab={renderPanelTab}
                  renderPanelTabIcon={renderPanelTabIcon}
                  scrollTargetHeading={leftPaneScrollHeading}
                  sourceMode={isSourceMode}
                  typewriterMode={isTypewriterMode}
                  userDefinedFields={userDefinedFields}
                  viewRef={leftEditorViewRef}
                  workspacePath={workspaceState?.activeWorkspace?.path}
                />
                {isSplit ? (
                  <PaneView
                    allFilePaths={existingMarkdownPaths}
                    closingTabIds={rightClosingTabIds}
                    editorSettings={editorSettings}
                    focusedPane={focusedPane}
                    frontmatterCandidates={frontmatterCandidates}
                    editorActionPulse={focusedPane === "right" ? editorActionPulse : 0}
                    onCreateFile={handleCreateNoteFromPane}
                    onFocus={() => setFocusedPane("right")}
                    onFileSaved={handleFileSaved}
                    onOpenLink={handleOpenMarkdownLink}
                    onOpenWikiLink={handleOpenWikiLink}
                    onScrollTargetHandled={() => setRightPaneScrollHeading(undefined)}
                    onTabClose={(tabId) => closeTabWithMotion("right", tabId)}
                    onTabMove={moveTab}
                    onTabSelect={(tabId) => setTabActive("right", tabId)}
                    onCloseOtherTabs={(tabId) => closeOtherTabsWithMotion("right", tabId)}
                    onCloseTabsToRight={(tabId) => closeTabsToRightWithMotion("right", tabId)}
                    onCloseAllTabs={() => closeAllTabsInPaneWithMotion("right")}
                    onDuplicateTabFile={handleDuplicateTabFile}
                    onOpenInOtherPane={(tabId) => openFileInOtherPane("right", tabId)}
                    onRevealTabFile={handleRevealTabFile}
                    onTogglePinTab={handleTogglePinTab}
                    pinnedPaths={pinnedPathSet}
                    isSplitView={isSplit}
                    pane="right"
                    renderGanttChartTab={renderGanttChartTab}
                    renderPanelTab={renderPanelTab}
                    renderPanelTabIcon={renderPanelTabIcon}
                    scrollTargetHeading={rightPaneScrollHeading}
                    sourceMode={isSourceMode}
                    typewriterMode={isTypewriterMode}
                    userDefinedFields={userDefinedFields}
                    viewRef={rightEditorViewRef}
                    workspacePath={workspaceState?.activeWorkspace?.path}
                  />
                ) : null}
              </div>
            </div>

              <aside
                aria-hidden={!isRightPanelOpen}
                className={`right-panel${isRightPanelOpen ? "" : " right-panel--closed"}`}
              >
                <div className="sidebar-header">
                  <div className="pane-heading">
                    {rightPanelView === "outline"
                      ? t("pane.outline")
                      : t("pane.links")}
                  </div>
                </div>
                <div className={`sidebar-body right-panel-content right-panel-content--${rightPanelView}`}>
                {rightPanelView === "outline" ? (
                  outlineHeadings.length > 0 ? (
                    <ul className="outline-list">
                      {outlineHeadings.map((h, i) => (
                        <li
                          className={`outline-item outline-item--h${h!.level}`}
                          key={i}
                          onClick={() => {
                            const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;
                            setScrollHeading(h!.text);
                          }}
                          title={h!.text}
                        >
                          {h!.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-note">{t("empty.noHeadings")}</div>
                  )
                ) : outgoingLinks.length > 0 || backlinks.length > 0 || isLoadingBacklinks ? (
                  <div className="links-panel-stack">
                    <div className="links-panel-section">
                      <div className="links-panel-subheading">{t("links.outgoing")}</div>
                      {outgoingLinks.length > 0 ? (
                        <ul className="links-list">
                          {outgoingLinks.map((link, i) => (
                            <li className="links-list-item" key={`${link.wikiLink.raw}-${i}`}>
                              <span className={`links-list-kind links-list-kind--${link.wikiLink.kind}`}>
                                {link.wikiLink.kind === "embed" ? t("links.embed") : t("links.link")}
                              </span>
                              <button
                                className={`links-list-target${link.exists ? "" : " links-list-target--missing"}`}
                                onClick={() => handleOpenWikiLink(link.wikiLink.target)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLinkContextMenu({
                                    heading: link.wikiLink.heading ?? undefined,
                                    markdownLink: link.wikiLink.raw,
                                    openKind: "wiki",
                                    path: link.path,
                                    target: link.wikiLink.target,
                                    ...fixedMenuPosition(e.clientX, e.clientY)
                                  });
                                }}
                                title={link.exists ? link.path : t("links.createAndOpen", { path: link.path })}
                                type="button"
                              >
                                {link.displayName}
                              </button>
                              {!link.exists ? (
                                <span className="links-list-detail">{t("links.missing")}</span>
                              ) : null}
                              {link.wikiLink.heading ? (
                                <span className="links-list-detail">#{link.wikiLink.heading}</span>
                              ) : null}
                              {link.wikiLink.blockId ? (
                                <span className="links-list-detail">^{link.wikiLink.blockId}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("empty.noLinks")}</div>
                      )}
                    </div>
                    <div className="links-panel-section">
                      <div className="links-panel-subheading">{t("links.backlinks")}</div>
                      {isLoadingBacklinks ? (
                        <div className="list-loading-note">{t("common.loading")}</div>
                      ) : backlinks.length > 0 ? (
                        <ul className="links-list">
                          {backlinks.map((backlink) => (
                            <li className="links-list-item" key={backlink.sourcePath}>
                              <span className="links-list-kind links-list-kind--backlink">
                                Back
                              </span>
                              <button
                                className="links-list-target"
                                onClick={() => handleOpenFile(backlink.sourcePath)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setLinkContextMenu({
                                    markdownLink: markdownLinkForPath(backlink.sourcePath),
                                    openKind: "file",
                                    path: backlink.sourcePath,
                                    ...fixedMenuPosition(e.clientX, e.clientY)
                                  });
                                }}
                                title={backlink.sourcePath}
                                type="button"
                              >
                                {backlink.sourceName}
                              </button>
                              {backlink.count > 1 ? (
                                <span className="links-list-detail">{backlink.count}</span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="empty-note">{t("empty.noBacklinks")}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="empty-note">{t("empty.noLinks")}</div>
                )}
                </div>
              </aside>
          </div>
        </main>
      </div>

      <footer className="status-bar">
        <span>Relic</span>
        {activeFileTabInFocusedPane ? (
          <span>
            {t("app.wordCount", {
              chars: activeFileTabInFocusedPane.content.length,
              words: activeFileTabInFocusedPane.content.split(/\s+/).filter(Boolean).length
            })}
          </span>
        ) : (
          <span>{t("app.wordCount", { chars: 0, words: 0 })}</span>
        )}
      </footer>

      {railTabFlight ? (
        <div
          className={`rail-tab-flight rail-tab-flight--${railTabFlight.direction}`}
          style={{
            "--rail-tab-flight-from-x": `${railTabFlight.fromX}px`,
            "--rail-tab-flight-from-y": `${railTabFlight.fromY}px`,
            "--rail-tab-flight-to-x": `${railTabFlight.toX}px`,
            "--rail-tab-flight-to-y": `${railTabFlight.toY}px`
          } as CSSProperties}
        >
          {railTabFlight.label}
        </div>
      ) : null}

      {sidebarCreateFlight ? (
        <div
          className="sidebar-create-flight"
          style={{
            "--sidebar-create-flight-from-x": `${sidebarCreateFlight.fromX}px`,
            "--sidebar-create-flight-from-y": `${sidebarCreateFlight.fromY}px`,
            "--sidebar-create-flight-to-x": `${sidebarCreateFlight.toX}px`,
            "--sidebar-create-flight-to-y": `${sidebarCreateFlight.toY}px`
          } as CSSProperties}
        >
          {sidebarCreateFlight.label}
        </div>
      ) : null}

      {showCommandPalette ? (
        <CommandPalette commands={commands} onClose={() => setShowCommandPalette(false)} />
      ) : null}

      {showQuickSwitcher ? (
        <QuickSwitcher
          aliasesByPath={aliasesByPath}
          filePaths={existingMarkdownPaths}
          onClose={() => setShowQuickSwitcher(false)}
          onSelect={handleOpenFile}
        />
      ) : null}

      {linkContextMenu ? (
        <div
          className="tab-context-menu link-context-menu"
          onClick={(e) => e.stopPropagation()}
          role="menu"
          style={{ left: linkContextMenu.x, position: "fixed", top: linkContextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              if (linkContextMenu.openKind === "wiki" && linkContextMenu.target) {
                handleOpenWikiLink(linkContextMenu.target, linkContextMenu.heading);
              } else {
                handleOpenFile(linkContextMenu.path);
              }
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.open")}
          </button>
          {isSplit ? (
            <button
              className="tab-context-menu-item"
              onClick={() => {
                openWorkspacePathInOtherPane(linkContextMenu.path, linkContextMenu.heading);
                setLinkContextMenu(null);
              }}
              role="menuitem"
              type="button"
            >
              {t("pane.openInOtherPane")}
            </button>
          ) : null}
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void navigator.clipboard?.writeText(linkContextMenu.markdownLink);
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.copyMarkdownLink")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              void navigator.clipboard?.writeText(linkContextMenu.path);
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.copyPath")}
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              handleRevealWorkspaceItem(linkContextMenu.path);
              setLinkContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {t("files.revealInFinder")}
          </button>
        </div>
      ) : null}

      {toastMessage ? (
        <div className={`toast toast--${toastMessage.type}${isToastClosing ? " toast--closing" : ""}`} onClick={closeToast}>
          {toastMessage.text}
        </div>
      ) : null}
    </div>
    </I18nProvider>
  );
}

// ────────────────────────────────────────────────
// RenameBar（ファイル名インライン変更）
// ────────────────────────────────────────────────

function RenameBar({ name, onRename }: { name: string; onRename: (v: string) => void }): ReactElement {
  const t = useT();
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(name);
    setEditing(false);
  }, [name]);

  if (!editing) {
    return (
      <button
        className="rename-bar-label"
        onClick={() => setEditing(true)}
        title={t("pane.rename")}
        type="button"
      >
        {name}
      </button>
    );
  }

  return (
    <form
      className="rename-bar-form"
      onSubmit={(e) => {
        e.preventDefault();
        onRename(draft);
        setEditing(false);
      }}
    >
      <input
        autoFocus
        className="rename-bar-input"
        onBlur={() => {
          onRename(draft);
          setEditing(false);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          }
        }}
        value={draft}
      />
    </form>
  );
}

function MoveBar({ onMove }: { onMove: (dest: string) => void }): ReactElement {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  if (!open) {
    return (
      <button
        className="toolbar-btn"
        onClick={() => setOpen(true)}
        title={t("pane.moveToFolder")}
        type="button"
      >
        {t("pane.moveShort")}
      </button>
    );
  }

  return (
    <form
      className="rename-bar-form"
      onSubmit={(e) => {
        e.preventDefault();
        onMove(draft);
        setDraft("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        className="rename-bar-input"
        onBlur={() => setOpen(false)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft("");
            setOpen(false);
          }
        }}
        placeholder={t("pane.moveDestination")}
        value={draft}
      />
    </form>
  );
}
