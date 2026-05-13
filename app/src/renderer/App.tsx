import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactElement, ReactNode } from "react";

import type {
  GanttChartEntry,
  WorkspaceGanttChart,
  WorkspaceState,
  WorkspaceTreeNode
} from "../shared/ipc";
import { resolveWikiLinks, type AliasIndex } from "../shared/links";
import { CommandPalette } from "./components/CommandPalette";
import { GanttChartView } from "./components/ChronicleSidebar";
import { FilesSidebar } from "./components/FilesSidebar";
import { FrontmatterSidebar } from "./components/FrontmatterSidebar";
import { GitSidebar } from "./components/GitSidebar";
import { GraphPanel } from "./components/GraphSidebar";
import { PaneView } from "./components/PaneView";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { ToolsSidebar } from "./components/ToolsSidebar";
import { Toolbar } from "./components/Toolbar";
import { extractOutlineHeadings, getActiveFileTabInPane, getActiveTabInPane } from "./editorDerivedState";
import { createTranslator, I18nProvider, useT, type TranslationKey } from "./i18n";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTheme } from "./hooks/useAppTheme";
import { useBacklinksState } from "./hooks/useBacklinksState";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { useGitPanelState } from "./hooks/useGitPanelState";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useWorkspaceFileActions } from "./hooks/useWorkspaceFileActions";
import { useWorkspaceSearchState } from "./hooks/useWorkspaceSearchState";
import { useEditorStore, type PaneId, type PanelTabKind } from "./store/editorStore";
import { useUiStore, type RightPanelView, type SidebarView } from "./store/uiStore";
import { collectMarkdownPaths } from "./workspacePaths";
import "./styles.css";

// ────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────

const IconFiles = ({ sidebarOpen = false }: { sidebarOpen?: boolean } = {}): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M3 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" />
    {sidebarOpen ? (
      <polyline points="12.75,8.75 10.25,11 12.75,13.25" />
    ) : (
      <polyline points="10.75,8.75 13.25,11 10.75,13.25" />
    )}
  </svg>
);

const IconGit = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="6" cy="5" r="2" />
    <circle cx="6" cy="15" r="2" />
    <circle cx="14" cy="5" r="2" />
    <line x1="6" x2="6" y1="7" y2="13" />
    <path d="M14 7c0 4-8 4-8 8" />
  </svg>
);

const IconTools = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M15 3a3.5 3.5 0 0 0-3.2 4.9L4.1 15.5a1.5 1.5 0 0 0 2.1 2.1l7.6-7.7A3.5 3.5 0 0 0 18.5 6.5L16 9l-2-2 2.5-2.5A3.5 3.5 0 0 0 15 3z" />
  </svg>
);

const IconFrontmatter = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <rect height="14" rx="2" width="12" x="4" y="3" />
    <line x1="7" x2="13" y1="7" y2="7" />
    <line x1="7" x2="11" y1="10" y2="10" />
    <line x1="7" x2="12" y1="13" y2="13" />
  </svg>
);

const IconChronicle = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="10" y2="10" />
    <circle cx="6" cy="10" r="2" />
    <rect height="4" rx="1.5" width="7" x="10" y="8" />
    <line x1="6" x2="6" y1="5" y2="15" />
    <line x1="13.5" x2="13.5" y1="5" y2="15" />
  </svg>
);

const IconGraph = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="5" cy="6" r="2" />
    <circle cx="14" cy="4" r="2" />
    <circle cx="15" cy="14" r="2" />
    <circle cx="6" cy="15" r="2" />
    <line x1="6.7" x2="12.2" y1="5.6" y2="4.4" />
    <line x1="14.3" x2="14.8" y1="6" y2="12" />
    <line x1="13.2" x2="7.8" y1="14.3" y2="14.8" />
    <line x1="6.2" x2="13.8" y1="7.5" y2="12.5" />
  </svg>
);

const IconSettings = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <line x1="3" x2="17" y1="5" y2="5" />
    <line x1="3" x2="17" y1="10" y2="10" />
    <line x1="3" x2="17" y1="15" y2="15" />
    <circle cx="7" cy="5" fill="currentColor" r="2" stroke="none" />
    <circle cx="13" cy="10" fill="currentColor" r="2" stroke="none" />
    <circle cx="7" cy="15" fill="currentColor" r="2" stroke="none" />
  </svg>
);

type RailViewId = SidebarView | PanelTabKind;

const sidebarViewDefs: Array<{ id: RailViewId; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "graph", labelKey: "nav.graph", icon: <IconGraph /> },
  { id: "git", labelKey: "nav.git", icon: <IconGit /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "frontmatter", labelKey: "nav.frontmatter", icon: <IconFrontmatter /> },
  { id: "chronicle", labelKey: "nav.chronicle", icon: <IconChronicle /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];

function joinWorkspacePath(folderPath: string, name: string): string {
  const normalizedFolder = folderPath.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const normalizedName = name.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  return normalizedFolder ? `${normalizedFolder}/${normalizedName}` : normalizedName;
}

function ensureMarkdownExtension(name: string): string {
  return name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
}

function markdownLinkForPath(path: string): string {
  return `[[${path.replace(/\.md$/i, "")}]]`;
}

function displayNameFromPath(path: string): string {
  return path.split("/").at(-1)?.replace(/\.md$/i, "") ?? path;
}

function fixedMenuPosition(x: number, y: number, estimatedHeight = 240): { x: number; y: number } {
  const margin = 8;
  const estimatedWidth = 220;
  const maxX = Math.max(margin, window.innerWidth - estimatedWidth - margin);
  const maxY = Math.max(margin, window.innerHeight - estimatedHeight - margin);

  return {
    x: Math.min(Math.max(margin, x), maxX),
    y: Math.min(Math.max(margin, y), maxY)
  };
}

const TAB_CLOSE_MOTION_MS = 180;

const paneTabMotionKey = (pane: PaneId, tabId: string): string => `${pane}:${tabId}`;

interface RailWorkspaceSwitcherProps {
  activeWorkspaceId: string | null;
  ariaLabel: string;
  onRenameActiveChange?: (isActive: boolean) => void;
  onRenameComplete?: () => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, currentName: string) => Promise<boolean>;
  onSwitchWorkspace: (id: string) => void;
  renameLabel: string;
  removeLabel: (name: string) => string;
  workspaces: WorkspaceState["workspaces"];
}

function RailWorkspaceSwitcher({
  activeWorkspaceId,
  ariaLabel,
  onRenameActiveChange,
  onRenameComplete,
  onRemoveWorkspace,
  onRenameWorkspace,
  onSwitchWorkspace,
  renameLabel,
  removeLabel,
  workspaces
}: RailWorkspaceSwitcherProps): ReactElement | null {
  const [contextMenu, setContextMenu] = useState<{ workspaceId: string; name: string; x: number; y: number } | null>(null);
  const [renamingWorkspace, setRenamingWorkspace] = useState<{ id: string; name: string; value: string } | null>(null);
  const [isComposingRename, setIsComposingRename] = useState(false);
  const isCommittingRenameRef = useRef(false);
  const skipNextRenameEnterKeyUpRef = useRef(false);
  const isRenamingWorkspace = renamingWorkspace !== null;

  useEffect(() => {
    onRenameActiveChange?.(isRenamingWorkspace);
  }, [isRenamingWorkspace, onRenameActiveChange]);

  useEffect(() => {
    return () => onRenameActiveChange?.(false);
  }, [onRenameActiveChange]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (): void => setContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("click", close);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  if (workspaces.length === 0) return null;

  const startRename = (workspaceId: string, name: string): void => {
    setContextMenu(null);
    isCommittingRenameRef.current = false;
    skipNextRenameEnterKeyUpRef.current = false;
    setRenamingWorkspace({ id: workspaceId, name, value: name });
  };

  const commitRename = async (value = renamingWorkspace?.value ?? ""): Promise<void> => {
    if (!renamingWorkspace) return;
    if (isCommittingRenameRef.current) return;

    const nextName = value.trim();
    const previousName = renamingWorkspace.name;
    const workspaceId = renamingWorkspace.id;
    isCommittingRenameRef.current = true;

    if (!nextName || nextName === previousName) {
      setRenamingWorkspace(null);
      return;
    }

    await onRenameWorkspace(workspaceId, nextName);
    onRenameComplete?.();
    setRenamingWorkspace(null);
  };

  const cancelRename = (): void => {
    setIsComposingRename(false);
    isCommittingRenameRef.current = false;
    skipNextRenameEnterKeyUpRef.current = false;
    setRenamingWorkspace(null);
  };

  return (
    <div className="workspace-switcher" aria-label={ariaLabel}>
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        const isRenaming = renamingWorkspace?.id === ws.id;
        const initial = ws.name.trim().charAt(0).toUpperCase() || "W";

        return (
          <div className={`workspace-switcher-item${isActive ? " active" : ""}`} key={ws.id}>
            {isRenaming ? (
              <div className="workspace-switcher-main workspace-switcher-main--editing">
                <span className="workspace-switcher-icon">{initial}</span>
                <input
                  aria-label={renameLabel}
                  autoFocus
                  className="workspace-switcher-input"
                  onBlur={(event) => {
                    void commitRename(event.currentTarget.value);
                  }}
                  onChange={(event) => {
                    setRenamingWorkspace((current) => (
                      current && current.id === ws.id
                        ? { ...current, value: event.target.value }
                        : current
                    ));
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onCompositionEnd={() => setIsComposingRename(false)}
                  onCompositionStart={() => setIsComposingRename(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (isComposingRename || event.nativeEvent.isComposing) {
                        skipNextRenameEnterKeyUpRef.current = true;
                        return;
                      }
                      event.preventDefault();
                      void commitRename(event.currentTarget.value);
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelRename();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== "Enter") return;
                    if (skipNextRenameEnterKeyUpRef.current) {
                      skipNextRenameEnterKeyUpRef.current = false;
                      return;
                    }
                    if (isComposingRename || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    void commitRename(event.currentTarget.value);
                  }}
                  value={renamingWorkspace.value}
                />
              </div>
            ) : (
              <button
                aria-label={ws.name}
                className="workspace-switcher-main"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ name: ws.name, workspaceId: ws.id, ...fixedMenuPosition(event.clientX, event.clientY, 96) });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  startRename(ws.id, ws.name);
                }}
                onClick={() => onSwitchWorkspace(ws.id)}
                title={ws.path}
                type="button"
              >
                <span className="workspace-switcher-icon">{initial}</span>
                <span className="workspace-switcher-name">{ws.name}</span>
              </button>
            )}
            <button
              aria-label={removeLabel(ws.name)}
              className="workspace-switcher-remove"
              onClick={() => onRemoveWorkspace(ws.id)}
              title={removeLabel(ws.name)}
              type="button"
            >
              ×
            </button>
          </div>
        );
      })}
      {contextMenu ? (
        <div
          className="tab-context-menu workspace-context-menu"
          onClick={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, position: "fixed", top: contextMenu.y, zIndex: 1000 }}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              startRename(contextMenu.workspaceId, contextMenu.name);
              setContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {renameLabel}
          </button>
          <button
            className="tab-context-menu-item danger"
            onClick={() => {
              onRemoveWorkspace(contextMenu.workspaceId);
              setContextMenu(null);
            }}
            role="menuitem"
            type="button"
          >
            {removeLabel(contextMenu.name)}
          </button>
        </div>
      ) : null}
    </div>
  );
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
  const [closingPaneTabs, setClosingPaneTabs] = useState<Set<string>>(() => new Set());
  const closeMotionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const splitCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSplitClosing, setIsSplitClosing] = useState(false);
  const [editorActionPulse, setEditorActionPulse] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [railTabFlight, setRailTabFlight] = useState<{
    direction: "open" | "close";
    fromX: number;
    fromY: number;
    label: string;
    toX: number;
    toY: number;
  } | null>(null);
  const [sidebarCreateFlight, setSidebarCreateFlight] = useState<{
    fromX: number;
    fromY: number;
    label: string;
    toX: number;
    toY: number;
  } | null>(null);
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

  const toggleSplitWithMotion = useCallback((): void => {
    if (!isSplit) {
      if (splitCloseTimerRef.current) clearTimeout(splitCloseTimerRef.current);
      setIsSplitClosing(false);
      toggleSplit();
      return;
    }

    if (isSplitClosing) return;

    setIsSplitClosing(true);
    splitCloseTimerRef.current = setTimeout(() => {
      toggleSplit();
      setIsSplitClosing(false);
      splitCloseTimerRef.current = null;
    }, 190);
  }, [isSplit, isSplitClosing, toggleSplit]);

  useEffect(() => {
    return () => {
      if (splitCloseTimerRef.current) clearTimeout(splitCloseTimerRef.current);
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

  useEffect(() => {
    const timers = closeMotionTimersRef.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  const clearClosingPaneTabs = useCallback((keys: string[]): void => {
    setClosingPaneTabs((current) => {
      const next = new Set(current);
      for (const key of keys) next.delete(key);
      return next;
    });

    for (const key of keys) {
      delete closeMotionTimersRef.current[key];
    }
  }, []);

  const startTabCloseFlight = useCallback((tabId: string): void => {
    const tab = useEditorStore.getState().tabs[tabId];
    if (!tab) return;

    const tabElement = document.querySelector<HTMLElement>(`.pane-tab[data-tab-id="${tabId}"]`);
    if (!tabElement) return;

    const tabRect = tabElement.getBoundingClientRect();

    setRailTabFlight({
      direction: "close",
      fromX: tabRect.left + tabRect.width / 2,
      fromY: tabRect.top + tabRect.height / 2,
      label: tab.name,
      toX: tabRect.left + tabRect.width / 2,
      toY: tabRect.top + tabRect.height / 2 + 2
    });
    window.setTimeout(() => {
      if (typeof window !== "undefined") setRailTabFlight(null);
    }, 260);
  }, []);

  const closeTabWithMotion = useCallback((pane: PaneId, tabId: string): void => {
    if (!useEditorStore.getState().tabs[tabId]) return;

    const key = paneTabMotionKey(pane, tabId);
    if (closingPaneTabs.has(key)) return;

    setClosingPaneTabs((current) => {
      if (current.has(key)) return current;
      return new Set(current).add(key);
    });

    startTabCloseFlight(tabId);

    closeMotionTimersRef.current[key] = setTimeout(() => {
      closeTab(pane, tabId);
      clearClosingPaneTabs([key]);
    }, TAB_CLOSE_MOTION_MS);
  }, [clearClosingPaneTabs, closeTab, closingPaneTabs, startTabCloseFlight]);

  const closeTabsWithMotion = useCallback((pane: PaneId, tabIds: string[], closeAction: () => void): void => {
    const targetKeys = tabIds
      .filter((tabId) => tabs[tabId])
      .map((tabId) => paneTabMotionKey(pane, tabId))
      .filter((key) => !closingPaneTabs.has(key));

    if (targetKeys.length === 0) return;

    setClosingPaneTabs((current) => {
      const next = new Set(current);
      for (const key of targetKeys) next.add(key);
      return next;
    });

    const timer = setTimeout(() => {
      closeAction();
      clearClosingPaneTabs(targetKeys);
    }, TAB_CLOSE_MOTION_MS);

    for (const key of targetKeys) {
      closeMotionTimersRef.current[key] = timer;
    }
  }, [clearClosingPaneTabs, closingPaneTabs, tabs]);

  const leftClosingTabIds = useMemo(
    () => new Set(leftPane.tabIds.filter((tabId) => closingPaneTabs.has(paneTabMotionKey("left", tabId)))),
    [closingPaneTabs, leftPane.tabIds]
  );
  const rightClosingTabIds = useMemo(
    () => new Set(rightPane.tabIds.filter((tabId) => closingPaneTabs.has(paneTabMotionKey("right", tabId)))),
    [closingPaneTabs, rightPane.tabIds]
  );

  const closeOtherTabsWithMotion = useCallback((pane: PaneId, tabId: string): void => {
    const paneState = pane === "left" ? leftPane : rightPane;
    closeTabsWithMotion(
      pane,
      paneState.tabIds.filter((id) => id !== tabId),
      () => closeOtherTabs(pane, tabId)
    );
  }, [closeOtherTabs, closeTabsWithMotion, leftPane, rightPane]);

  const closeTabsToRightWithMotion = useCallback((pane: PaneId, tabId: string): void => {
    const paneState = pane === "left" ? leftPane : rightPane;
    const tabIndex = paneState.tabIds.indexOf(tabId);
    closeTabsWithMotion(
      pane,
      tabIndex === -1 ? [] : paneState.tabIds.slice(tabIndex + 1),
      () => closeTabsToRight(pane, tabId)
    );
  }, [closeTabsToRight, closeTabsWithMotion, leftPane, rightPane]);

  const closeAllTabsInPaneWithMotion = useCallback((pane: PaneId): void => {
    const paneState = pane === "left" ? leftPane : rightPane;
    closeTabsWithMotion(pane, paneState.tabIds, () => closeAllTabsInPane(pane));
  }, [closeAllTabsInPane, closeTabsWithMotion, leftPane, rightPane]);

  const {
    appInfo,
    autoSyncSettings,
    featureToggles,
    gitHubIntegrationSettings,
    handleSaveAutoSyncSettings,
    handleSaveFeatureToggles,
    handleSaveGitHubIntegrationSettings,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  } = useAppSettingsState({
    setEditorSettings,
    setWorkspaceError,
    setWorkspaceState,
    workspaceState
  });

  const gitPanel = useGitPanelState({
    gitHubIntegrationSettings,
    setWorkspaceError,
    setWorkspaceState,
    t,
    workspaceState
  });

  const {
    gitStatus,
    gitHubAuthStatus,
    gitRemotes,
    gitCommitHistory,
    gitWorkingChanges,
    selectedGitCommitHash,
    selectedGitCommitDiff,
    gitRemoteUrl,
    gitSyncMessage,
    gitErrorMessage,
    gitRetryAction,
    gitCommitMessage,
    gitSyncPreview,
    gitSyncStep,
    gitConflicts,
    gitCloneUrl,
    isCreatingGitCommit,
    isConnectingGitHub,
    isConnectingGitRemote,
    isDisconnectingGitHub,
    isPullingGitBranch,
    isPushingGitBranch,
    isCloningGitHub,
    isResolvingConflict,
    handleInitializeGitRepository,
    handleCloneGitHubRepository,
    handleConnectGitHubAccount,
    handleDisconnectGitHubAccount,
    handleConnectGitRemote,
    handlePushGitBranch,
    handlePullGitBranch,
    handleConfirmPush,
    handleConfirmPull,
    handleCreateGitCommit,
    handleResolveConflict,
    setSelectedGitCommitHash,
    setGitRemoteUrl,
    setGitSyncStep,
    setGitCommitMessage,
    setGitCloneUrl
  } = gitPanel;

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
      setRailTabFlight({
        direction: "close",
        fromX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
        fromY: (tabBarRect?.top ?? rowRect.top) + 15,
        label: displayNameFromPath(path),
        toX: rowRect.left + rowRect.width / 2,
        toY: rowRect.top + rowRect.height / 2
      });
      window.setTimeout(() => {
        if (typeof window !== "undefined") setRailTabFlight(null);
      }, 360);
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

    setRailTabFlight({
      direction: "open",
      fromX: rowRect.left + rowRect.width / 2,
      fromY: rowRect.top + rowRect.height / 2,
      label,
      toX: (tabBarRect?.left ?? rowRect.left + rowRect.width + 120) + 48,
      toY: (tabBarRect?.top ?? rowRect.top) + 15
    });
    window.setTimeout(() => {
      if (typeof window !== "undefined") setRailTabFlight(null);
    }, 360);

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
  }, [handleOpenFile, openFileInPane, setTabActive, setWorkspaceError]);

  const renderPanelTabIcon = useCallback((panel: PanelTabKind): ReactNode => (
    sidebarViews.find((view) => view.id === panel)?.icon ?? null
  ), [sidebarViews]);

  const renderGanttChartTab = useCallback((chartId: string): ReactNode => (
    <GanttChartView
      chart={chartId === "charts" ? null : ganttCharts.find((chart) => chart.id === chartId) ?? null}
      charts={chartId === "charts" ? ganttCharts : undefined}
      onOpenFile={handleOpenFile}
    />
  ), [ganttCharts, handleOpenFile]);

  const handleCreateFileFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tabBar = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const tabBarRect = tabBar?.getBoundingClientRect();

      setRailTabFlight({
        direction: "open",
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("files.createNote"),
        toX: (tabBarRect?.left ?? buttonRect.left + buttonRect.width + 120) + 48,
        toY: (tabBarRect?.top ?? buttonRect.top) + 15
      });
      window.setTimeout(() => {
        if (typeof window !== "undefined") setRailTabFlight(null);
      }, 360);
    }

    handleCreateFile();
  }, [focusedPane, handleCreateFile, t]);

  const handleCreateFolderFromSidebar = useCallback((event?: MouseEvent<HTMLButtonElement>): void => {
    if (event) {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const tree = document.querySelector(".sidebar-view-content--files .file-tree");
      const treeRect = tree?.getBoundingClientRect();

      setSidebarCreateFlight({
        fromX: buttonRect.left + buttonRect.width / 2,
        fromY: buttonRect.top + buttonRect.height / 2,
        label: t("files.createFolder"),
        toX: (treeRect?.left ?? buttonRect.left) + 24,
        toY: (treeRect?.top ?? buttonRect.top + 72) + 14
      });
      window.setTimeout(() => setSidebarCreateFlight(null), 300);
    }

    handleCreateFolder();
  }, [handleCreateFolder, t]);

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
    handlePullGitBranch,
    handlePushGitBranch,
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
    frontmatter: t("nav.frontmatter"),
    graph: t("nav.graph"),
    git: t("nav.git"),
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
    if (view.id === "git" && !featureToggles.git) return false;
    if (view.id === "tools" && !featureToggles.tools) return false;
    if (view.id === "frontmatter" && !featureToggles.frontmatter) return false;
    return true;
  }), [featureToggles.frontmatter, featureToggles.git, featureToggles.tools, sidebarViews]);
  const primaryRailViews = enabledRailViews.filter((view) =>
    view.id === "files" || view.id === "graph"
  );
  const chartRailView = enabledRailViews.find((view) => view.id === "chronicle");
  const panelRailViews = enabledRailViews.filter((view) =>
    view.id !== "files" && view.id !== "graph" && view.id !== "chronicle"
  );

  useEffect(() => {
    if (
      activeSidebarView !== "git" &&
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
      setRailTabFlight(null);
      setTabActive(openedPanes.includes(focusedPane) ? focusedPane : openedPanes[0], panelTabId);
      return;
    }

    openPanelInPane(focusedPane, panel, label);

    requestAnimationFrame(() => {
      const pane = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const toRect = pane?.getBoundingClientRect();
      setRailTabFlight({
        direction: "open",
        fromX: railRect.left + railRect.width / 2,
        fromY: railRect.top + railRect.height / 2,
        label,
        toX: (toRect?.left ?? railRect.left + 180) + 48,
        toY: (toRect?.top ?? railRect.top) + 15
      });
      window.setTimeout(() => {
        if (typeof window !== "undefined") setRailTabFlight(null);
      }, 360);
    });
  }, [focusedPane, openPanelInPane, setTabActive]);

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
      setRailTabFlight(null);
      setTabActive(openedPanes.includes(focusedPane) ? focusedPane : openedPanes[0], tabId);
      return;
    }

    closeSidebar();
    openGanttChartInPane(focusedPane, { id: "charts", name: label });

    requestAnimationFrame(() => {
      const pane = document.querySelector(`.pane${focusedPane === "left" ? "" : ":last-child"} .pane-tab-bar`) ?? document.querySelector(".pane-tab-bar");
      const toRect = pane?.getBoundingClientRect();
      setRailTabFlight({
        direction: "open",
        fromX: railRect.left + railRect.width / 2,
        fromY: railRect.top + railRect.height / 2,
        label,
        toX: (toRect?.left ?? railRect.left + 180) + 48,
        toY: (toRect?.top ?? railRect.top) + 15
      });
      window.setTimeout(() => {
        if (typeof window !== "undefined") setRailTabFlight(null);
      }, 360);
    });
  }, [closeSidebar, focusedPane, openGanttChartInPane, setTabActive]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "git") {
      return (
        <GitSidebar
          gitStatus={gitStatus}
          gitHubAuthStatus={gitHubAuthStatus}
          gitRemotes={gitRemotes}
          gitCommitHistory={gitCommitHistory}
          gitWorkingChanges={gitWorkingChanges}
          selectedGitCommitHash={selectedGitCommitHash}
          selectedGitCommitDiff={selectedGitCommitDiff}
          gitRemoteUrl={gitRemoteUrl}
          gitSyncMessage={gitSyncMessage}
          gitErrorMessage={gitErrorMessage}
          gitRetryAction={gitRetryAction}
          gitCommitMessage={gitCommitMessage}
          gitSyncPreview={gitSyncPreview}
          gitSyncStep={gitSyncStep}
          gitConflicts={gitConflicts}
          gitCloneUrl={gitCloneUrl}
          isCreatingGitCommit={isCreatingGitCommit}
          isConnectingGitHub={isConnectingGitHub}
          isConnectingGitRemote={isConnectingGitRemote}
          isDisconnectingGitHub={isDisconnectingGitHub}
          isPullingGitBranch={isPullingGitBranch}
          isPushingGitBranch={isPushingGitBranch}
          isCloningGitHub={isCloningGitHub}
          isResolvingConflict={isResolvingConflict}
          hasWorkspace={!!workspaceState?.activeWorkspace}
          onInitializeGitRepository={handleInitializeGitRepository}
          onCloneGitHubRepository={handleCloneGitHubRepository}
          onConnectGitHubAccount={handleConnectGitHubAccount}
          onDisconnectGitHubAccount={handleDisconnectGitHubAccount}
          onConnectGitRemote={handleConnectGitRemote}
          onPushGitBranch={handlePushGitBranch}
          onPullGitBranch={handlePullGitBranch}
          onConfirmPush={handleConfirmPush}
          onConfirmPull={handleConfirmPull}
          onCreateGitCommit={handleCreateGitCommit}
          onResolveConflict={handleResolveConflict}
          onSelectCommitHash={setSelectedGitCommitHash}
          onSetGitRemoteUrl={setGitRemoteUrl}
          onSetGitSyncStep={setGitSyncStep}
          onSetGitCommitMessage={setGitCommitMessage}
          onSetGitCloneUrl={setGitCloneUrl}
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
        autoSyncSettings={autoSyncSettings}
        featureToggles={featureToggles}
        gitHubIntegrationSettings={gitHubIntegrationSettings}
        onAutoSyncSave={handleSaveAutoSyncSettings}
        onFeatureTogglesSave={handleSaveFeatureToggles}
        onGitHubIntegrationSave={handleSaveGitHubIntegrationSettings}
        onSave={handleSaveSettings}
        settings={editorSettings}
      />
    );
  }, [
    appInfo, autoSyncSettings, editorSettings, featureToggles, gitCloneUrl,
    gitCommitHistory, gitCommitMessage, gitConflicts, gitErrorMessage, gitHubAuthStatus, gitHubIntegrationSettings,
    gitRemotes, gitRemoteUrl, gitRetryAction, gitStatus, gitSyncMessage, gitSyncPreview, gitSyncStep,
    gitWorkingChanges, handleCloneGitHubRepository, handleConfirmPull, handleConfirmPush,
    handleConnectGitHubAccount, handleConnectGitRemote, handleCreateGitCommit,
    handleDisconnectGitHubAccount, handleInitializeGitRepository, handlePullGitBranch, handlePushGitBranch,
    handleResolveConflict, handleSaveAutoSyncSettings, handleSaveFeatureToggles,
    activeFilePathForGraph, handleSaveGitHubIntegrationSettings, handleSaveSettings, handleSaveUserDefinedFields, handleOpenFile,
    isCloningGitHub, isConnectingGitHub, isConnectingGitRemote,
    isCreatingGitCommit, isDisconnectingGitHub, isPullingGitBranch,
    isPushingGitBranch, isResolvingConflict, selectedGitCommitDiff, selectedGitCommitHash,
    setGitCloneUrl, setGitCommitMessage, setGitRemoteUrl, setGitSyncStep,
    setSelectedGitCommitHash, userDefinedFields, workspaceState, activeFileTabInFocusedPane
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
                className={`rail-button${view.id === "graph" ? activePanelTabIds.has("graph") ? " active" : openPanelTabIds.has("graph") ? " open" : "" : view.id === activeSidebarView && isSidebarOpen ? " active" : ""}`}
                key={view.id}
                onClick={(event) => {
                  if (view.id === "graph") {
                    handleRailPanelButton("graph", view.label, event);
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

function normalizeWorkspaceGanttCharts(value: unknown): WorkspaceGanttChart[] {
  if (!Array.isArray(value)) return [];

  if (value.every(isWorkspaceGanttChart)) return fixedWorkspaceGanttCharts(value);

  const legacyEntries = value.flatMap((entry): GanttChartEntry[] => {
    if (typeof entry !== "object" || entry === null) return [];

    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.path !== "string" ||
      typeof candidate.fileName !== "string" ||
      typeof candidate.startYear !== "number" ||
      typeof candidate.endYear !== "number"
    ) return [];

    return [{
      endLabel: formatLegacyChronicleYear(candidate.endYear),
      endValue: legacyChronicleYearToAxis(candidate.endYear),
      fileName: candidate.fileName,
      path: candidate.path,
      startLabel: formatLegacyChronicleYear(candidate.startYear),
      startValue: legacyChronicleYearToAxis(candidate.startYear)
    }];
  });

  return legacyEntries.length > 0
    ? fixedWorkspaceGanttCharts([{ entries: legacyEntries, filePaths: legacyEntries.map((entry) => entry.path), id: "chronicle", name: "chronicle", source: "chronicle" }])
    : fixedWorkspaceGanttCharts([]);
}

function fixedWorkspaceGanttCharts(charts: WorkspaceGanttChart[]): WorkspaceGanttChart[] {
  const chronicle = charts.find((chart) => chart.source === "chronicle" || chart.id === "chronicle");
  const date = charts.find((chart) => chart.source === "date" || chart.id === "date");

  return [
    {
      entries: chronicle?.entries ?? [],
      filePaths: chronicle?.filePaths ?? [],
      id: "chronicle",
      name: "chronicle",
      source: "chronicle"
    },
    {
      entries: date?.entries ?? [],
      filePaths: date?.filePaths ?? [],
      id: "date",
      name: "date",
      source: "date"
    }
  ];
}

function isWorkspaceGanttChart(value: unknown): value is WorkspaceGanttChart {
  if (typeof value !== "object" || value === null) return false;

  const chart = value as Record<string, unknown>;
  return (
    typeof chart.id === "string" &&
    typeof chart.name === "string" &&
    (chart.source === "chronicle" || chart.source === "date") &&
    Array.isArray(chart.entries) &&
    (!("filePaths" in chart) || Array.isArray(chart.filePaths))
  );
}

function legacyChronicleYearToAxis(year: number): number {
  return year < 0 ? year : year - 1;
}

function formatLegacyChronicleYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
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
