import { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type {
  AppInfo,
  AutoSyncSettings,
  Backlink,
  GitCommitDiff,
  GitBranchSummary,
  GitConflict,
  AppTheme,
  EditorSettings,
  GitCommitSummary,
  GitHubAuthStatus,
  GitRemoteSummary,
  GitStatus,
  GitSyncPreview,
  GitTagSummary,
  GitWorkingChange,
  MarkdownTemplateSummary,
  SearchMode,
  WorkspaceState,
  WorkspaceSearchResult,
  WorkspaceTagSummary,
  WorkspaceTreeNode
} from "../shared/ipc";
import { defaultAutoSyncSettings, defaultFeatureToggles, defaultUserDefinedFields, type FeatureToggles, type UserDefinedField } from "../shared/ipc";
import { resolveWikiLinkPath, resolveWikiLinks } from "../shared/links";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { FilesSidebar } from "./components/FilesSidebar";
import { FrontmatterForm } from "./components/FrontmatterForm";
import { GitSidebar } from "./components/GitSidebar";
import { PaneView } from "./components/PaneView";
import { QuickSwitcher } from "./components/QuickSwitcher";
import { SearchSidebar } from "./components/SearchSidebar";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { ToolsSidebar } from "./components/ToolsSidebar";
import { Toolbar } from "./components/Toolbar";
import { createTranslator, I18nProvider, useT, type TranslationKey } from "./i18n";
import { useEditorStore, type PaneId } from "./store/editorStore";
import { useUiStore, type RightPanelView, type SidebarView } from "./store/uiStore";
import "./styles.css";

// ────────────────────────────────────────────────
// App
// ────────────────────────────────────────────────

const IconFiles = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <path d="M3 5a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" />
  </svg>
);

const IconSearch = (): ReactElement => (
  <svg fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20" width="18">
    <circle cx="8.5" cy="8.5" r="5" />
    <line x1="13" x2="17" y1="13" y2="17" />
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

const sidebarViewDefs: Array<{ id: SidebarView; labelKey: TranslationKey; icon: ReactElement }> = [
  { id: "files", labelKey: "nav.files", icon: <IconFiles /> },
  { id: "search", labelKey: "nav.search", icon: <IconSearch /> },
  { id: "git", labelKey: "nav.git", icon: <IconGit /> },
  { id: "tools", labelKey: "nav.tools", icon: <IconTools /> },
  { id: "settings", labelKey: "nav.settings", icon: <IconSettings /> }
];

const joinWorkspacePath = (folder: string, name: string): string => (
  folder ? `${folder}/${name}` : name
);

const parentFolderOf = (path: string): string => {
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
};

const displayNameFromPath = (path: string): string => {
  const name = path.split("/").at(-1) ?? path;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
};

export function App(): ReactElement {
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "error" | "info" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((text: string, type: "error" | "info" = "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);
  const setWorkspaceError = useCallback((msg: string | null) => {
    if (msg) showToast(msg, "error");
  }, [showToast]);
  const [fileNameDraft, setFileNameDraft] = useState("");
  const [folderNameDraft, setFolderNameDraft] = useState("");
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
  const [workspaceTags, setWorkspaceTags] = useState<WorkspaceTagSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("fullText");
  const [searchFrontmatterField, setSearchFrontmatterField] = useState("");
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [leftPaneScrollHeading, setLeftPaneScrollHeading] = useState<string | undefined>(undefined);
  const [rightPaneScrollHeading, setRightPaneScrollHeading] = useState<string | undefined>(undefined);
  const [frontmatterCandidates, setFrontmatterCandidates] = useState<Record<string, string[]>>({});
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitHubAuthStatus, setGitHubAuthStatus] = useState<GitHubAuthStatus | null>(null);
  const [gitRemotes, setGitRemotes] = useState<GitRemoteSummary[]>([]);
  const [gitBranches, setGitBranches] = useState<GitBranchSummary[]>([]);
  const [gitCommitHistory, setGitCommitHistory] = useState<GitCommitSummary[]>([]);
  const [gitTags, setGitTags] = useState<GitTagSummary[]>([]);
  const [gitWorkingChanges, setGitWorkingChanges] = useState<GitWorkingChange[]>([]);
  const [selectedGitCommitHash, setSelectedGitCommitHash] = useState<string | null>(null);
  const [selectedGitCommitDiff, setSelectedGitCommitDiff] = useState<GitCommitDiff | null>(null);
  const [newGitBranchName, setNewGitBranchName] = useState("");
  const [newGitTagName, setNewGitTagName] = useState("");
  const [newGitTagMessage, setNewGitTagMessage] = useState("");
  const [gitRemoteUrl, setGitRemoteUrl] = useState("");
  const [gitSyncMessage, setGitSyncMessage] = useState<string | null>(null);
  const [gitErrorMessage, setGitErrorMessage] = useState<string | null>(null);
  const [gitRetryAction, setGitRetryAction] = useState<(() => void) | null>(null);
  const [pendingGitBranchSwitch, setPendingGitBranchSwitch] = useState<string | null>(null);
  const [gitCommitMessage, setGitCommitMessage] = useState("");
  const [gitAuthorName, setGitAuthorName] = useState("");
  const [gitAuthorEmail, setGitAuthorEmail] = useState("");
  const [isCreatingGitBranch, setIsCreatingGitBranch] = useState(false);
  const [isCreatingGitCommit, setIsCreatingGitCommit] = useState(false);
  const [isCreatingGitTag, setIsCreatingGitTag] = useState(false);
  const [isConnectingGitHub, setIsConnectingGitHub] = useState(false);
  const [isConnectingGitRemote, setIsConnectingGitRemote] = useState(false);
  const [isDeletingGitTag, setIsDeletingGitTag] = useState(false);
  const [isDisconnectingGitHub, setIsDisconnectingGitHub] = useState(false);
  const [isPullingGitBranch, setIsPullingGitBranch] = useState(false);
  const [isPushingGitBranch, setIsPushingGitBranch] = useState(false);
  const [pushingGitTagName, setPushingGitTagName] = useState<string | null>(null);
  const [isSwitchingGitBranch, setIsSwitchingGitBranch] = useState(false);
  const [gitCloneUrl, setGitCloneUrl] = useState("");
  const [isCloningGitHub, setIsCloningGitHub] = useState(false);
  const [gitSyncPreview, setGitSyncPreview] = useState<GitSyncPreview | null>(null);
  const [gitSyncStep, setGitSyncStep] = useState<"push-preview" | "pull-preview" | "pull-fetching" | null>(null);
  const [gitConflicts, setGitConflicts] = useState<GitConflict[]>([]);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [autoSyncSettings, setAutoSyncSettings] = useState<AutoSyncSettings>(defaultAutoSyncSettings);
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>(defaultFeatureToggles);
  const [userDefinedFields, setUserDefinedFields] = useState<UserDefinedField[]>(defaultUserDefinedFields);
  const [markdownTemplates, setMarkdownTemplates] = useState<MarkdownTemplateSummary[]>([]);
  const [selectedTemplatePath, setSelectedTemplatePath] = useState("");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);

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
    openFileInPane,
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
    toggleRightPanel,
    toggleSidebar,
    toggleTypewriterMode
  } = useUiStore();

  const t = useMemo(() => createTranslator(editorSettings.language), [editorSettings.language]);
  const sidebarViews = useMemo(
    () =>
      sidebarViewDefs.map((view) => ({
        ...view,
        label: t(view.labelKey)
      })),
    [t]
  );

  const handleRightPanelViewButton = useCallback((view: RightPanelView): void => {
    if (isRightPanelOpen && rightPanelView === view) {
      toggleRightPanel();
      return;
    }

    setRightPanelView(view);
  }, [isRightPanelOpen, rightPanelView, setRightPanelView, toggleRightPanel]);

  // テーマ適用
  useEffect(() => {
    function applyTheme(theme: AppTheme) {
      const root = document.documentElement;
      if (theme === "system") {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", theme);
      }
    }

    applyTheme(editorSettings.theme ?? "system");

    if ((editorSettings.theme ?? "system") === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = () => applyTheme("system");
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
  }, [editorSettings.theme]);

  const [sidebarWidth, setSidebarWidth] = useState(260);
  const sidebarResizingRef = useRef(false);
  const sidebarResizeStartXRef = useRef(0);
  const sidebarResizeStartWidthRef = useRef(0);
  const leftEditorViewRef = useRef<EditorView | null>(null);
  const rightEditorViewRef = useRef<EditorView | null>(null);

  const applyGitBranches = useCallback((branches: GitBranchSummary[]): void => {
    setGitBranches(branches);

    const currentBranch = branches.find((branch) => branch.isCurrent)?.name ?? null;

    setGitStatus((current) =>
      current
        ? {
            ...current,
            currentBranch
          }
        : current
    );
  }, []);

  // 初期ロード
  useEffect(() => {
    let canceled = false;

    void window.relic?.getAppInfo().then((result) => {
      if (canceled) return;
      if (result.ok) setAppInfo(result.value);
    });

    void window.relic?.getWorkspaceState().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic?.getEditorSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setEditorSettings(result.value);
    });

    void window.relic?.getGitHubAuthStatus().then((result) => {
      if (canceled) return;
      if (result.ok) setGitHubAuthStatus(result.value);
    });

    void window.relic?.getAutoSyncSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAutoSyncSettings(result.value);
    });

    void window.relic?.getFeatureToggles().then((result) => {
      if (canceled) return;
      if (result.ok) setFeatureToggles(result.value);
    });

    void window.relic?.getUserDefinedFields().then((result) => {
      if (canceled) return;
      if (result.ok) setUserDefinedFields(result.value);
    });

    return () => { canceled = true; };
  }, [setEditorSettings]);

  useEffect(() => {
    let canceled = false;

    void window.relic?.getAutoSyncSettings().then((result) => {
      if (canceled) return;
      if (result.ok) setAutoSyncSettings(result.value);
    });

    return () => { canceled = true; };
  }, [workspaceState?.activeWorkspace?.id]);

  useEffect(() => {
    let canceled = false;

    void window.relic?.getMarkdownTemplates().then((result) => {
      if (canceled) return;
      if (result.ok) {
        setMarkdownTemplates(result.value);
        if (!result.value.some((template) => template.path === selectedTemplatePath)) {
          setSelectedTemplatePath("");
        }
      }
    });

    return () => { canceled = true; };
  }, [workspaceState?.activeWorkspace?.id, selectedTemplatePath]);

  // ──────────────────
  // ワークスペース操作
  // ──────────────────

  const handleOpenWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsOpeningWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .openWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsOpeningWorkspace(false));
  }, []);

  const handleCreateNewWorkspace = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingWorkspace(true);
    setWorkspaceError(null);

    void window.relic
      .createNewWorkspace()
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingWorkspace(false));
  }, []);

  const handleCreateFile = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFile(true);
    setWorkspaceError(null);

    void window.relic
      .createMarkdownFile({ name: fileNameDraft, templatePath: selectedTemplatePath || undefined })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFileNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFile(false));
  }, [fileNameDraft, selectedTemplatePath]);

  const handleCreateNoteFromPane = useCallback((name: string): void => {
    if (!window.relic) return;

    void window.relic
      .createMarkdownFile({ name, templatePath: selectedTemplatePath || undefined })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          const newFile = result.value.fileTree
            .flatMap(function flatten(n): string[] {
              return n.type === "file" ? [n.path] : n.children.flatMap(flatten);
            })
            .find((p) => p.endsWith(`${name}.md`));

          if (newFile) {
            void window.relic!.readMarkdownFile({ path: newFile }).then((r) => {
              if (r.ok) openFileInPane(focusedPane, r.value);
            });
          }
        } else {
          setWorkspaceError(result.error.message);
        }
      });
  }, [focusedPane, openFileInPane, selectedTemplatePath]);

  const handleCreateFolder = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingFolder(true);
    setWorkspaceError(null);

    void window.relic
      .createFolder({ name: folderNameDraft })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setFolderNameDraft("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingFolder(false));
  }, [folderNameDraft]);

  const handleOpenFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void window.relic.readMarkdownFile({ path }).then((result) => {
        if (result.ok) {
          openFileInPane(focusedPane, result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [focusedPane, openFileInPane]
  );

  const handleOpenWikiLink = useCallback(
    (target: string, heading?: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const activeTab = paneState.activeTabId ? tabs[paneState.activeTabId] : null;

      if (!activeTab || !window.relic) return;

      const path = resolveWikiLinkPath(target, activeTab.path);
      const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;

      void window.relic.readMarkdownFile({ path }).then((readResult) => {
        if (readResult.ok) {
          openFileInPane(focusedPane, readResult.value);
          if (heading) setScrollHeading(heading);
          return;
        }

        void window.relic!.createLinkedMarkdownFile({ path }).then((createResult) => {
          if (createResult.ok) {
            setWorkspaceState(createResult.value.workspaceState);
            openFileInPane(focusedPane, createResult.value.file);
          } else {
            setWorkspaceError(createResult.error.message);
          }
        });
      });
    },
    [focusedPane, leftPane, openFileInPane, rightPane, tabs]
  );

  const handleTagSearch = useCallback((tag: string): void => {
    setSearchMode("tag");
    setSearchQuery(tag);
    setSidebarView("search");
  }, [setSidebarView]);

  const openFileInOtherPane = useCallback((fromPane: PaneId, tabId: string) => {
    const tab = tabs[tabId];
    if (!tab || !isSplit) return;
    const otherPane = fromPane === "left" ? "right" : "left";
    openFileInPane(otherPane, { content: tab.content, name: tab.name, path: tab.path });
  }, [tabs, isSplit, openFileInPane]);

  const handleSelectFolder = useCallback(
    (node: Extract<WorkspaceTreeNode, { type: "folder" }>): void => {
      void node; // フェーズ2ではフォルダ選択は何もしない
    },
    []
  );

  const handleSwitchWorkspace = useCallback((workspaceId: string): void => {
    if (!window.relic) return;

    void window.relic.switchWorkspace({ workspaceId }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
        closeAllTabs();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [closeAllTabs]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setWorkspaceTags([]);
      return;
    }

    let canceled = false;

    void window.relic.getWorkspaceTags().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setWorkspaceTags(result.value);
      } else {
        setWorkspaceTags([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic || searchQuery.trim() === "") {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    let canceled = false;

    void window.relic
      .searchWorkspace({
        frontmatterField: searchMode === "frontmatter" ? searchFrontmatterField : undefined,
        mode: searchMode,
        query: searchQuery
      })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setSearchResults(result.value);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setSearchError(result.error.message);
        }
      });

    return () => {
      canceled = true;
    };
  }, [searchFrontmatterField, searchMode, searchQuery, workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setFrontmatterCandidates({});
      return;
    }

    void window.relic.getFrontmatterCandidates().then((result) => {
      if (result.ok) setFrontmatterCandidates(result.value);
    });
  }, [workspaceState?.activeWorkspace?.id, workspaceState?.fileTree]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic) {
      setGitStatus(null);
      setGitBranches([]);
      setGitCommitHistory([]);
      setGitTags([]);
      setGitWorkingChanges([]);
      setPendingGitBranchSwitch(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitStatus().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitStatus(result.value);
      } else {
        setGitStatus(null);
        setSelectedGitCommitHash(null);
        setSelectedGitCommitDiff(null);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [workspaceState?.activeWorkspace?.id]);

  useEffect(() => {
    if (!workspaceState?.activeWorkspace || !window.relic || !gitStatus?.initialized) {
      setGitBranches([]);
      setGitCommitHistory([]);
      setGitRemotes([]);
      setGitTags([]);
      setGitWorkingChanges([]);
      setSelectedGitCommitHash(null);
      setSelectedGitCommitDiff(null);
      setPendingGitBranchSwitch(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitBranches().then((result) => {
      if (canceled) return;

      if (result.ok) {
        applyGitBranches(result.value);
      } else {
        setGitBranches([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitRemotes().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitRemotes(result.value);
        setGitRemoteUrl(result.value.find((remote) => remote.isOrigin)?.url ?? "");
      } else {
        setGitRemotes([]);
      }
    });

    void window.relic.getGitCommitHistory().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitCommitHistory(result.value);
        if (result.value.length > 0 && !selectedGitCommitHash) {
          setSelectedGitCommitHash(result.value[0].hash);
        }
      } else {
        setGitCommitHistory([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitTags().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitTags(result.value);
      } else {
        setGitTags([]);
        setWorkspaceError(result.error.message);
      }
    });

    void window.relic.getGitWorkingChanges().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setGitWorkingChanges(result.value);
      } else {
        setGitWorkingChanges([]);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [
    applyGitBranches,
    gitStatus?.initialized,
    selectedGitCommitHash,
    workspaceState?.activeWorkspace?.id,
    workspaceState?.fileTree
  ]);

  useEffect(() => {
    if (!window.relic || !selectedGitCommitHash || !gitStatus?.initialized) {
      setSelectedGitCommitDiff(null);
      return;
    }

    let canceled = false;

    void window.relic.getGitCommitDiff(selectedGitCommitHash).then((result) => {
      if (canceled) return;

      if (result.ok) {
        setSelectedGitCommitDiff(result.value);
      } else {
        setSelectedGitCommitDiff(null);
        setWorkspaceError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [gitStatus?.initialized, selectedGitCommitHash]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!e.metaKey) return;

      if (e.shiftKey && e.key === "P") {
        e.preventDefault();
        setShowQuickSwitcher(false);
        setShowCommandPalette((v) => !v);
      } else if (!e.shiftKey && e.key === "p") {
        e.preventDefault();
        setShowCommandPalette(false);
        setShowQuickSwitcher((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // ──────────────────
  // エディタ設定保存
  // ──────────────────

  const handleSaveSettings = useCallback(
    (settings: EditorSettings): void => {
      setEditorSettings(settings);
      void window.relic?.saveEditorSettings(settings);
    },
    [setEditorSettings]
  );

  const refreshGitWorkingChanges = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitWorkingChanges().then((result) => {
      if (result.ok) {
        setGitWorkingChanges(result.value);
      } else {
        setGitWorkingChanges([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const refreshGitCommitHistory = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitCommitHistory().then((result) => {
      if (result.ok) {
        setGitCommitHistory(result.value);
        setSelectedGitCommitHash((current) => {
          if (result.value.length === 0) {
            return null;
          }

          return current && result.value.some((commit) => commit.hash === current)
            ? current
            : result.value[0].hash;
        });
      } else {
        setGitCommitHistory([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const refreshGitTags = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitTags().then((result) => {
      if (result.ok) {
        setGitTags(result.value);
      } else {
        setGitTags([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const refreshGitBranches = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.getGitBranches().then((result) => {
      if (result.ok) {
        applyGitBranches(result.value);
      } else {
        setGitBranches([]);
        setWorkspaceError(result.error.message);
      }
    });
  }, [applyGitBranches]);

  const handleInitializeGitRepository = useCallback((): void => {
    if (!window.relic) return;

    void window.relic.initializeGitRepository().then((result) => {
      if (result.ok) {
        setGitStatus(result.value);
        setPendingGitBranchSwitch(null);
        setWorkspaceError(null);
        refreshGitBranches();
        refreshGitCommitHistory();
        refreshGitTags();
        refreshGitWorkingChanges();
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [refreshGitBranches, refreshGitCommitHistory, refreshGitTags, refreshGitWorkingChanges]);

  const handleCreateGitBranch = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitBranch(true);
    setWorkspaceError(null);

    void window.relic
      .createGitBranch({ name: newGitBranchName })
      .then((result) => {
        if (result.ok) {
          applyGitBranches(result.value);
          setNewGitBranchName("");
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsCreatingGitBranch(false));
  }, [applyGitBranches, newGitBranchName]);

  const handleSwitchGitBranch = useCallback(
    (name: string, allowDirty = false): void => {
      if (!window.relic) return;

      setIsSwitchingGitBranch(true);
      setWorkspaceError(null);

      void window.relic
        .switchGitBranch({ allowDirty, name })
        .then((result) => {
          if (result.ok) {
            applyGitBranches(result.value);
            setPendingGitBranchSwitch(null);
            refreshGitCommitHistory();
            refreshGitWorkingChanges();
            return;
          }

          if (result.error.code === "GIT_BRANCH_SWITCH_DIRTY") {
            setPendingGitBranchSwitch(name);
            return;
          }

          setWorkspaceError(result.error.message);
        })
        .finally(() => setIsSwitchingGitBranch(false));
    },
    [applyGitBranches, refreshGitCommitHistory, refreshGitWorkingChanges]
  );

  const handleCreateGitCommit = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitCommit(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        authorEmail: gitAuthorEmail,
        authorName: gitAuthorName,
        message: gitCommitMessage
      })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitCommitMessage("");
        setGitCommitHistory((current) => [result.value, ...current]);
        setSelectedGitCommitHash(result.value.hash);
        setPendingGitBranchSwitch(null);
        refreshGitWorkingChanges();
      })
      .finally(() => setIsCreatingGitCommit(false));
  }, [gitAuthorEmail, gitAuthorName, gitCommitMessage, refreshGitWorkingChanges]);

  const handleCreateGitTag = useCallback((): void => {
    if (!window.relic) return;

    setIsCreatingGitTag(true);
    setWorkspaceError(null);

    void window.relic
      .createGitTag({
        hash: selectedGitCommitHash ?? undefined,
        message: newGitTagMessage,
        name: newGitTagName,
        taggerEmail: gitAuthorEmail,
        taggerName: gitAuthorName
      })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitTags(result.value);
        setNewGitTagName("");
        setNewGitTagMessage("");
      })
      .finally(() => setIsCreatingGitTag(false));
  }, [gitAuthorEmail, gitAuthorName, newGitTagMessage, newGitTagName, selectedGitCommitHash]);

  const handleDeleteGitTag = useCallback((name: string): void => {
    if (!window.relic) return;

    setIsDeletingGitTag(true);
    setWorkspaceError(null);

    void window.relic
      .deleteGitTag({ name })
      .then((result) => {
        if (!result.ok) {
          setWorkspaceError(result.error.message);
          return;
        }

        setGitTags(result.value);
      })
      .finally(() => setIsDeletingGitTag(false));
  }, []);

  const handleCommitAndSwitchGitBranch = useCallback((): void => {
    if (!window.relic || !pendingGitBranchSwitch) return;

    setIsCreatingGitCommit(true);
    setIsSwitchingGitBranch(true);
    setWorkspaceError(null);

    void window.relic
      .createGitCommit({
        authorEmail: gitAuthorEmail,
        authorName: gitAuthorName,
        message: gitCommitMessage
      })
      .then((commitResult) => {
        if (!commitResult.ok) {
          setWorkspaceError(commitResult.error.message);
          return;
        }

        setGitCommitMessage("");
        setGitCommitHistory((current) => [commitResult.value, ...current]);
        setSelectedGitCommitHash(commitResult.value.hash);

        return window.relic!.switchGitBranch({ name: pendingGitBranchSwitch });
      })
      .then((switchResult) => {
        if (!switchResult) {
          return;
        }

        if (switchResult.ok) {
          applyGitBranches(switchResult.value);
          setPendingGitBranchSwitch(null);
          refreshGitCommitHistory();
          refreshGitWorkingChanges();
        } else {
          setWorkspaceError(switchResult.error.message);
        }
      })
      .finally(() => {
        setIsCreatingGitCommit(false);
        setIsSwitchingGitBranch(false);
      });
  }, [
    applyGitBranches,
    gitAuthorEmail,
    gitAuthorName,
    gitCommitMessage,
    pendingGitBranchSwitch,
    refreshGitCommitHistory,
    refreshGitWorkingChanges
  ]);

  const handleConnectGitHubAccount = useCallback((): void => {
    if (!window.relic) return;

    setIsConnectingGitHub(true);
    setWorkspaceError(null);

    void window.relic
      .connectGitHubAccount()
      .then((result) => {
        if (result.ok) {
          setGitHubAuthStatus(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsConnectingGitHub(false));
  }, []);

  const handleDisconnectGitHubAccount = useCallback((): void => {
    if (!window.relic) return;

    setIsDisconnectingGitHub(true);
    setWorkspaceError(null);

    void window.relic
      .disconnectGitHubAccount()
      .then((result) => {
        if (result.ok) {
          setGitHubAuthStatus(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsDisconnectingGitHub(false));
  }, []);

  const handleConnectGitRemote = useCallback((): void => {
    if (!window.relic) return;

    setIsConnectingGitRemote(true);
    setGitSyncMessage(null);
    setWorkspaceError(null);

    void window.relic
      .connectGitRemote({ url: gitRemoteUrl })
      .then((result) => {
        if (result.ok) {
          setGitRemotes(result.value);
          setGitRemoteUrl(result.value.find((remote) => remote.isOrigin)?.url ?? gitRemoteUrl);
          setGitSyncMessage(t("git.remoteConnected"));
        } else {
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => setIsConnectingGitRemote(false));
  }, [gitRemoteUrl, t]);

  const clearGitMessages = (): void => {
    setGitSyncMessage(null);
    setGitErrorMessage(null);
    setGitRetryAction(null);
  };

  const handleShowPushPreview = useCallback((): void => {
    if (!window.relic) return;

    clearGitMessages();
    setGitSyncStep("pull-fetching");

    void window.relic
      .getGitSyncPreview()
      .then((result) => {
        if (result.ok) {
          setGitSyncPreview(result.value);
          setGitSyncStep("push-preview");
        } else {
          setGitSyncStep(null);
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleShowPushPreview);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShowPullPreview = useCallback((): void => {
    if (!window.relic) return;

    clearGitMessages();
    setGitSyncStep("pull-fetching");

    void window.relic
      .getGitSyncPreview()
      .then((result) => {
        if (result.ok) {
          setGitSyncPreview(result.value);
          setGitSyncStep("pull-preview");
        } else {
          setGitSyncStep(null);
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleShowPullPreview);
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmPush = useCallback((): void => {
    if (!window.relic) return;

    setIsPushingGitBranch(true);
    setGitSyncStep(null);

    void window.relic
      .pushGitBranch()
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
          refreshGitWorkingChanges();
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleConfirmPush);
        }
      })
      .finally(() => setIsPushingGitBranch(false));
  }, [refreshGitWorkingChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmPull = useCallback((): void => {
    if (!window.relic) return;

    setIsPullingGitBranch(true);
    setGitSyncStep(null);

    void window.relic
      .pullGitBranch()
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
          refreshGitCommitHistory();
          refreshGitWorkingChanges();
          void window.relic?.getGitConflicts().then((r) => {
            if (r.ok) setGitConflicts(r.value);
          });
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => handleConfirmPull);
          void window.relic?.getGitConflicts().then((r) => {
            if (r.ok) setGitConflicts(r.value);
          });
        }
      })
      .finally(() => setIsPullingGitBranch(false));
  }, [refreshGitCommitHistory, refreshGitWorkingChanges]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResolveConflict = useCallback((filePath: string, resolution: "ours" | "theirs"): void => {
    if (!window.relic) return;

    setIsResolvingConflict(true);

    void window.relic
      .resolveGitConflict({ path: filePath, resolution })
      .then((result) => {
        if (result.ok) {
          setGitConflicts(result.value);
          refreshGitWorkingChanges();
        } else {
          setGitErrorMessage(result.error.message);
        }
      })
      .finally(() => setIsResolvingConflict(false));
  }, [refreshGitWorkingChanges]);

  const handleCloneGitHubRepository = useCallback((): void => {
    if (!window.relic) return;

    setIsCloningGitHub(true);
    setGitErrorMessage(null);

    void window.relic
      .cloneGitHubRepository({ url: gitCloneUrl })
      .then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value);
          setGitCloneUrl("");
        } else {
          setGitErrorMessage(result.error.message);
        }
      })
      .finally(() => setIsCloningGitHub(false));
  }, [gitCloneUrl]);

  const handleSaveAutoSyncSettings = useCallback((settings: AutoSyncSettings): void => {
    setAutoSyncSettings(settings);
    void window.relic?.saveAutoSyncSettings(settings);
  }, []);

  const handleSaveFeatureToggles = useCallback((toggles: FeatureToggles): void => {
    setFeatureToggles(toggles);
    void window.relic?.saveFeatureToggles(toggles);
  }, []);

  const handleSaveUserDefinedFields = useCallback((fields: UserDefinedField[]): void => {
    setUserDefinedFields(fields);
    void window.relic?.saveUserDefinedFields(fields);
  }, []);

  const handlePushGitBranch = (): void => { handleShowPushPreview(); };
  const handlePullGitBranch = (): void => { handleShowPullPreview(); };

  const handlePushGitTag = useCallback((name: string): void => {
    if (!window.relic) return;

    setPushingGitTagName(name);
    clearGitMessages();

    void window.relic
      .pushGitTag({ name })
      .then((result) => {
        if (result.ok) {
          setGitSyncMessage(result.value.message);
        } else {
          setGitErrorMessage(result.error.message);
          setGitRetryAction(() => () => handlePushGitTag(name));
        }
      })
      .finally(() => setPushingGitTagName(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ──────────────────
  // ファイル移動
  // ──────────────────

  const handleTogglePin = useCallback((path: string): void => {
    if (!window.relic) return;

    void window.relic.togglePin(path).then((result) => {
      if (result.ok) setWorkspaceState(result.value);
      else setWorkspaceError(result.error.message);
    });
  }, []);

  const handleMoveFile = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveMarkdownFile({ destinationFolder: destFolder, path }).then((result) => {
      if (result.ok) {
        const oldTab = Object.entries(tabs).find(([, t]) => t.path === path);

        if (oldTab) updateTabMeta(oldTab[0], { name: result.value.file.name, path: result.value.file.path });
        setWorkspaceState(result.value.workspaceState);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [tabs, updateTabMeta]);

  const handleMoveFolder = useCallback((path: string, destFolder: string): void => {
    if (!window.relic) return;

    void window.relic.moveFolder({ destinationFolder: destFolder, path }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  const handleMoveActiveFile = useCallback(
    (destinationFolder: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const tabId = paneState.activeTabId;

      if (!tabId || !window.relic) return;

      const tab = tabs[tabId];

      if (!tab) return;

      void window.relic
        .moveMarkdownFile({ destinationFolder, path: tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, tabs, updateTabMeta]
  );

  const handleRefreshWorkspaceState = useCallback((): void => {
    void window.relic?.getWorkspaceState().then((result) => {
      if (result.ok) setWorkspaceState(result.value);
    });
  }, []);

  const handleCreateFrontmatterTemplate = useCallback((): void => {
    void window.relic?.createFrontmatterTemplate().then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, []);

  // ──────────────────
  // ファイル名リネーム（タブのメタ更新）
  // ──────────────────

  const handleRenameActiveFile = useCallback(
    (newName: string): void => {
      const paneState = focusedPane === "left" ? leftPane : rightPane;
      const tabId = paneState.activeTabId;

      if (!tabId || !window.relic) return;

      const tab = tabs[tabId];

      if (!tab) return;

      void window.relic
        .renameMarkdownFile({ newName, path: tab.path })
        .then((result) => {
          if (result.ok) {
            updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
    },
    [focusedPane, leftPane, rightPane, tabs, updateTabMeta]
  );

  const handleRenameTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"], newName: string): void => {
      if (!window.relic) return;

      if (type === "file") {
        void window.relic.renameMarkdownFile({ newName, path }).then((result) => {
          if (result.ok) {
            Object.entries(tabs)
              .filter(([, tab]) => tab.path === path)
              .forEach(([tabId]) => {
                updateTabMeta(tabId, { name: result.value.file.name, path: result.value.file.path });
              });
            setWorkspaceState(result.value.workspaceState);
          } else {
            setWorkspaceError(result.error.message);
          }
        });
        return;
      }

      void window.relic.renameFolder({ newName, path }).then((result) => {
        if (result.ok) {
          const nextFolderPath = joinWorkspacePath(parentFolderOf(path), newName);

          Object.entries(tabs)
            .filter(([, tab]) => tab.path.startsWith(`${path}/`))
            .forEach(([tabId, tab]) => {
              const nextPath = `${nextFolderPath}/${tab.path.slice(path.length + 1)}`;
              updateTabMeta(tabId, { name: displayNameFromPath(nextPath), path: nextPath });
            });
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [tabs, updateTabMeta, setWorkspaceError]
  );

  const handleDuplicateActiveFile = useCallback((): void => {
    const paneState = focusedPane === "left" ? leftPane : rightPane;
    const tabId = paneState.activeTabId;
    if (!tabId || !window.relic) return;
    const tab = tabs[tabId];
    if (!tab) return;
    void window.relic.duplicateMarkdownFile({ path: tab.path }).then((result) => {
      if (result.ok) {
        setWorkspaceState(result.value.workspaceState);
        openFileInPane(focusedPane, result.value.file);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, leftPane, rightPane, tabs, openFileInPane]);

  const handleDuplicateTreeFile = useCallback(
    (path: string): void => {
      if (!window.relic) return;

      void window.relic.duplicateMarkdownFile({ path }).then((result) => {
        if (result.ok) {
          setWorkspaceState(result.value.workspaceState);
          openFileInPane(focusedPane, result.value.file);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [focusedPane, openFileInPane, setWorkspaceError]
  );

  const handleDeleteActiveFile = useCallback((): void => {
    const paneState = focusedPane === "left" ? leftPane : rightPane;
    const tabId = paneState.activeTabId;
    if (!tabId || !window.relic) return;
    const tab = tabs[tabId];
    if (!tab) return;
    if (!window.confirm(`「${tab.name}」をゴミ箱に移動しますか？`)) return;
    void window.relic.moveItemToTrash({ path: tab.path, type: "file" }).then((result) => {
      if (result.ok) {
        closeTab(focusedPane, tabId);
        setWorkspaceState(result.value);
      } else {
        setWorkspaceError(result.error.message);
      }
    });
  }, [focusedPane, leftPane, rightPane, tabs, closeTab]);

  const handleDeleteTreeItem = useCallback(
    (path: string, type: WorkspaceTreeNode["type"]): void => {
      if (!window.relic) return;

      const name = displayNameFromPath(path);
      const message = type === "folder"
        ? `「${name}」フォルダをゴミ箱に移動しますか？フォルダ内のノートと添付ファイルも一緒に移動されます。`
        : `「${name}」をゴミ箱に移動しますか？`;
      if (!window.confirm(message)) return;

      void window.relic.moveItemToTrash({ path, type }).then((result) => {
        if (result.ok) {
          const matchesPath = (tabPath: string): boolean => (
            type === "file" ? tabPath === path : tabPath.startsWith(`${path}/`)
          );

          leftPane.tabIds.forEach((tabId) => {
            const tab = tabs[tabId];
            if (tab && matchesPath(tab.path)) closeTab("left", tabId);
          });
          rightPane.tabIds.forEach((tabId) => {
            const tab = tabs[tabId];
            if (tab && matchesPath(tab.path)) closeTab("right", tabId);
          });
          setWorkspaceState(result.value);
        } else {
          setWorkspaceError(result.error.message);
        }
      });
    },
    [leftPane, rightPane, tabs, closeTab, setWorkspaceError]
  );

  // ──────────────────
  // キーボードショートカット
  // ──────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!e.metaKey) return;

      if (e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === "\\") {
        e.preventDefault();
        toggleSplit();
      } else if (e.key === "b" && e.shiftKey) {
        e.preventDefault();
        toggleRightPanel();
      } else if (e.key === "w") {
        e.preventDefault();
        const paneState = focusedPane === "left" ? leftPane : rightPane;
        if (paneState.activeTabId) closeTab(focusedPane, paneState.activeTabId);
      } else if (e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        setSidebarView("search");
      } else if (e.key === "f" && e.shiftKey) {
        e.preventDefault();
        setSidebarView("search");
      } else if (e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        setSidebarView("files");
        setIsCreatingFile(true);
      } else if (e.key === "T" && e.shiftKey) {
        e.preventDefault();
        toggleTypewriterMode();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [focusedPane, leftPane, rightPane, closeTab, setSidebarView, toggleSidebar, toggleSplit, toggleRightPanel, setIsCreatingFile, toggleTypewriterMode]);

  // ──────────────────
  // サイドバーリサイズ
  // ──────────────────

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!sidebarResizingRef.current) return;
      const delta = e.clientX - sidebarResizeStartXRef.current;
      const next = Math.max(180, Math.min(500, sidebarResizeStartWidthRef.current + delta));
      setSidebarWidth(next);
    };
    const handleMouseUp = (): void => {
      sidebarResizingRef.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // ──────────────────
  // アクティブなパスのセット（ファイルツリーのハイライト用）
  // ──────────────────

  const activePaths = new Set(Object.values(tabs).map((t) => t.path));
  const existingMarkdownPaths = useMemo(
    () => collectMarkdownPaths(workspaceState?.fileTree ?? []),
    [workspaceState?.fileTree]
  );

  // ──────────────────
  // アウトライン（右パネル）
  // ──────────────────

  const activeTabInFocusedPane = (() => {
    const paneState = focusedPane === "left" ? leftPane : rightPane;

    return paneState.activeTabId ? tabs[paneState.activeTabId] : null;
  })();

  const outlineHeadings = activeTabInFocusedPane
    ? activeTabInFocusedPane.content
        .split("\n")
        .filter((line) => /^#{1,6} /.test(line))
        .map((line) => {
          const match = /^(#{1,6}) (.+)/.exec(line);

          return match ? { level: match[1].length, text: match[2] } : null;
        })
        .filter(Boolean)
    : [];
  const outgoingLinks = activeTabInFocusedPane
    ? resolveWikiLinks(activeTabInFocusedPane.content, activeTabInFocusedPane.path, existingMarkdownPaths)
    : [];

  useEffect(() => {
    if (!activeTabInFocusedPane || !window.relic) {
      setBacklinks([]);
      return;
    }

    let canceled = false;
    setIsLoadingBacklinks(true);

    void window.relic
      .getBacklinks({ path: activeTabInFocusedPane.path })
      .then((result) => {
        if (canceled) return;

        if (result.ok) {
          setBacklinks(result.value);
        } else {
          setBacklinks([]);
          setWorkspaceError(result.error.message);
        }
      })
      .finally(() => {
        if (!canceled) setIsLoadingBacklinks(false);
      });

    return () => {
      canceled = true;
    };
  }, [activeTabInFocusedPane?.path, workspaceState?.fileTree]);

  // ──────────────────
  // コマンドパレット
  // ──────────────────

  const commands: Command[] = [
    {
      id: "new-note",
      label: t("pane.createNote"),
      shortcut: "⌘N",
      action: () => { setSidebarView("files"); setIsCreatingFile(true); }
    },
    {
      id: "search",
      label: t("command.search"),
      shortcut: "⌘F",
      action: () => { setSidebarView("search"); }
    },
    {
      id: "quick-switcher",
      label: t("command.quickSwitcher"),
      shortcut: "⌘P",
      action: () => setShowQuickSwitcher(true)
    },
    {
      id: "toggle-sidebar",
      label: t("command.sidebar"),
      shortcut: "⌘B",
      action: toggleSidebar
    },
    {
      id: "toggle-split",
      label: t("command.split"),
      shortcut: "⌘\\",
      action: toggleSplit
    },
    {
      id: "toggle-right-panel",
      label: t("command.rightPanel"),
      shortcut: "⌘⇧B",
      action: toggleRightPanel
    },
    {
      id: "toggle-typewriter",
      label: t("command.typewriter"),
      shortcut: "⌘⇧T",
      action: toggleTypewriterMode
    },
    {
      id: "git",
      label: t("command.gitView"),
      action: () => { setSidebarView("git"); }
    },
    {
      id: "git-push",
      label: t("command.gitPush"),
      action: () => { setSidebarView("git"); handlePushGitBranch(); }
    },
    {
      id: "git-pull",
      label: t("command.gitPull"),
      action: () => { setSidebarView("git"); handlePullGitBranch(); }
    },
    ...(gitBranches.length > 1
      ? gitBranches
          .filter((b) => !b.isCurrent)
          .map((b) => ({
            id: `git-branch-${b.name}`,
            label: t("command.branchSwitch", { name: b.name }),
            action: () => { setSidebarView("git"); handleSwitchGitBranch(b.name); }
          }))
      : []),
    ...(activeTabInFocusedPane
      ? [
          {
            id: "rename-file",
            label: t("command.renameFile", { name: activeTabInFocusedPane.name }),
            action: () => {
              setSidebarView("files");
            }
          },
          {
            id: "duplicate-file",
            label: t("command.duplicateFile", { name: activeTabInFocusedPane.name }),
            action: handleDuplicateActiveFile
          },
          {
            id: "delete-file",
            label: t("command.deleteFile", { name: activeTabInFocusedPane.name }),
            action: handleDeleteActiveFile
          }
        ]
      : []),
    {
      id: "settings",
      label: t("command.settings"),
      action: () => { setSidebarView("settings"); }
    }
  ];

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className="app-shell">
      <div className="title-bar" />
      <div className="workspace">
        {/* 縦アイコンナビ（レール） */}
        <nav aria-label={t("nav.viewSwitcher")} className="rail">
          <button
            aria-label={t("pane.toggleSidebar")}
            className="rail-button"
            onClick={toggleSidebar}
            title={t("pane.toggleSidebarShortcut")}
            type="button"
          >
            {isSidebarOpen ? (
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 16 16" width="16">
                <polyline points="10,3 5,8 10,13" />
              </svg>
            ) : (
              <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 16 16" width="16">
                <polyline points="6,3 11,8 6,13" />
              </svg>
            )}
          </button>
          <div className="rail-separator" />
          {sidebarViews
            .filter((view) => {
              if (view.id === "git" && !featureToggles.git) return false;
              if (view.id === "tools" && !featureToggles.tools) return false;
              return true;
            })
            .map((view) => (
              <button
                aria-label={view.label}
                className={`rail-button${view.id === activeSidebarView ? " active" : ""}`}
                key={view.id}
                onClick={() => setSidebarView(view.id)}
                title={view.label}
                type="button"
              >
                {view.icon}
              </button>
            ))}
        </nav>

        {/* サイドバー */}
        {isSidebarOpen ? (
          <aside className="sidebar" style={{ width: sidebarWidth }}>
            <div className="sidebar-header">
              <div className="pane-heading">
                {sidebarViews.find((v) => v.id === activeSidebarView)?.label}
              </div>
            </div>
            <div className="sidebar-body">
            {activeSidebarView === "files" ? (
              <FilesSidebar
                activePaths={activePaths}
                fileNameDraft={fileNameDraft}
                folderNameDraft={folderNameDraft}
                isCreatingFile={isCreatingFile}
                isCreatingFolder={isCreatingFolder}
                isCreatingWorkspace={isCreatingWorkspace}
                isOpeningWorkspace={isOpeningWorkspace}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onCreateWorkspace={handleCreateNewWorkspace}
                onDeleteItem={handleDeleteTreeItem}
                onDuplicateFile={handleDuplicateTreeFile}
                onFileNameDraftChange={setFileNameDraft}
                onFolderNameDraftChange={setFolderNameDraft}
                onMoveFile={handleMoveFile}
                onMoveFolder={handleMoveFolder}
                onOpenFile={handleOpenFile}
                onOpenWorkspace={handleOpenWorkspace}
                onRenameItem={handleRenameTreeItem}
                onSelectFolder={handleSelectFolder}
                onSwitchWorkspace={handleSwitchWorkspace}
                onTogglePin={handleTogglePin}
                onTemplatePathChange={setSelectedTemplatePath}
                selectedTemplatePath={selectedTemplatePath}
                templates={markdownTemplates}
                workspaceState={workspaceState}
              />
            ) : activeSidebarView === "search" ? (
              <SearchSidebar
                activeFilePath={activeTabInFocusedPane?.path ?? null}
                error={searchError}
                frontmatterCandidates={frontmatterCandidates}
                frontmatterField={searchFrontmatterField}
                mode={searchMode}
                onFrontmatterFieldChange={setSearchFrontmatterField}
                onModeChange={setSearchMode}
                onOpenFile={handleOpenFile}
                onQueryChange={setSearchQuery}
                onTagSelect={(tag) => {
                  setSearchMode("tag");
                  setSearchQuery(tag);
                }}
                onWorkspaceChange={handleRefreshWorkspaceState}
                query={searchQuery}
                results={searchResults}
                tags={workspaceTags}
              />
            ) : activeSidebarView === "git" ? (
              <GitSidebar
                gitStatus={gitStatus}
                gitHubAuthStatus={gitHubAuthStatus}
                gitRemotes={gitRemotes}
                gitBranches={gitBranches}
                gitCommitHistory={gitCommitHistory}
                gitTags={gitTags}
                gitWorkingChanges={gitWorkingChanges}
                selectedGitCommitHash={selectedGitCommitHash}
                selectedGitCommitDiff={selectedGitCommitDiff}
                newGitBranchName={newGitBranchName}
                newGitTagName={newGitTagName}
                newGitTagMessage={newGitTagMessage}
                gitRemoteUrl={gitRemoteUrl}
                gitSyncMessage={gitSyncMessage}
                gitErrorMessage={gitErrorMessage}
                gitRetryAction={gitRetryAction}
                pendingGitBranchSwitch={pendingGitBranchSwitch}
                gitCommitMessage={gitCommitMessage}
                gitAuthorName={gitAuthorName}
                gitAuthorEmail={gitAuthorEmail}
                gitSyncPreview={gitSyncPreview}
                gitSyncStep={gitSyncStep}
                gitConflicts={gitConflicts}
                gitCloneUrl={gitCloneUrl}
                isCreatingGitBranch={isCreatingGitBranch}
                isCreatingGitCommit={isCreatingGitCommit}
                isCreatingGitTag={isCreatingGitTag}
                isConnectingGitHub={isConnectingGitHub}
                isConnectingGitRemote={isConnectingGitRemote}
                isDeletingGitTag={isDeletingGitTag}
                isDisconnectingGitHub={isDisconnectingGitHub}
                isPullingGitBranch={isPullingGitBranch}
                isPushingGitBranch={isPushingGitBranch}
                pushingGitTagName={pushingGitTagName}
                isSwitchingGitBranch={isSwitchingGitBranch}
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
                onCreateGitBranch={handleCreateGitBranch}
                onSwitchGitBranch={handleSwitchGitBranch}
                onCommitAndSwitchGitBranch={handleCommitAndSwitchGitBranch}
                onCreateGitCommit={handleCreateGitCommit}
                onCreateGitTag={handleCreateGitTag}
                onDeleteGitTag={handleDeleteGitTag}
                onPushGitTag={handlePushGitTag}
                onResolveConflict={handleResolveConflict}
                onSelectCommitHash={setSelectedGitCommitHash}
                onSetNewGitBranchName={setNewGitBranchName}
                onSetNewGitTagName={setNewGitTagName}
                onSetNewGitTagMessage={setNewGitTagMessage}
                onSetGitRemoteUrl={setGitRemoteUrl}
                onSetGitSyncStep={setGitSyncStep}
                onSetPendingGitBranchSwitch={setPendingGitBranchSwitch}
                onSetGitCommitMessage={setGitCommitMessage}
                onSetGitAuthorName={setGitAuthorName}
                onSetGitAuthorEmail={setGitAuthorEmail}
                onSetGitCloneUrl={setGitCloneUrl}
              />
            ) : activeSidebarView === "tools" ? (
              <ToolsSidebar workspacePath={workspaceState?.activeWorkspace?.path ?? null} />
            ) : (
              <SettingsSidebar
                appInfo={appInfo}
                autoSyncSettings={autoSyncSettings}
                featureToggles={featureToggles}
                onAutoSyncSave={handleSaveAutoSyncSettings}
                onCreateFrontmatterTemplate={handleCreateFrontmatterTemplate}
                onFeatureTogglesSave={handleSaveFeatureToggles}
                onSave={handleSaveSettings}
                onUserDefinedFieldsSave={handleSaveUserDefinedFields}
                settings={editorSettings}
                userDefinedFields={userDefinedFields}
              />
            )}
            <div
              className="sidebar-resize-handle"
              onMouseDown={(e) => {
                sidebarResizingRef.current = true;
                sidebarResizeStartXRef.current = e.clientX;
                sidebarResizeStartWidthRef.current = sidebarWidth;
                e.preventDefault();
              }}
            />
            </div>
          </aside>
        ) : null}

        {/* メインエリア */}
        <main className="main-area">
          <div className="main-area-top-bar">
            {activeTabInFocusedPane ? (
              <>
                <RenameBar
                  name={activeTabInFocusedPane.name}
                  onRename={handleRenameActiveFile}
                />
                <MoveBar onMove={handleMoveActiveFile} />
              </>
            ) : null}
            <div className="main-area-top-actions">
              <button
                className={`toolbar-btn${isSplit ? " active" : ""}`}
                onClick={toggleSplit}
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
                  {featureToggles.frontmatter ? (
                    <button
                      className={`toolbar-btn${rightPanelView === "frontmatter" && isRightPanelOpen ? " active" : ""}`}
                      onClick={() => handleRightPanelViewButton("frontmatter")}
                      title={t("pane.toggleFrontmatter")}
                      type="button"
                    >
                      {t("pane.frontmatter")}
                    </button>
                  ) : null}
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
                <Toolbar viewRef={focusedPane === "left" ? leftEditorViewRef : rightEditorViewRef} />
              </div>
              <div className={`panes-container${isSplit ? " panes-container--split" : ""}`}>
                <PaneView
                  allFilePaths={existingMarkdownPaths}
                  editorSettings={editorSettings}
                  focusedPane={focusedPane}
                  onCreateNote={handleCreateNoteFromPane}
                  onFocus={() => setFocusedPane("left")}
                  onScrollTargetHandled={() => setLeftPaneScrollHeading(undefined)}
                  onTabClose={(tabId) => closeTab("left", tabId)}
                  onTabSelect={(tabId) => setTabActive("left", tabId)}
                  onCloseOtherTabs={(tabId) => closeOtherTabs("left", tabId)}
                  onCloseTabsToRight={(tabId) => closeTabsToRight("left", tabId)}
                  onCloseAllTabs={() => closeAllTabsInPane("left")}
                  onOpenInOtherPane={(tabId) => openFileInOtherPane("left", tabId)}
                  isSplitView={isSplit}
                  pane="left"
                  scrollTargetHeading={leftPaneScrollHeading}
                  typewriterMode={isTypewriterMode}
                  viewRef={leftEditorViewRef}
                  workspacePath={workspaceState?.activeWorkspace?.path}
                />
                {isSplit ? (
                  <PaneView
                    allFilePaths={existingMarkdownPaths}
                    editorSettings={editorSettings}
                    focusedPane={focusedPane}
                    onCreateNote={handleCreateNoteFromPane}
                    onFocus={() => setFocusedPane("right")}
                    onScrollTargetHandled={() => setRightPaneScrollHeading(undefined)}
                    onTabClose={(tabId) => closeTab("right", tabId)}
                    onTabSelect={(tabId) => setTabActive("right", tabId)}
                    onCloseOtherTabs={(tabId) => closeOtherTabs("right", tabId)}
                    onCloseTabsToRight={(tabId) => closeTabsToRight("right", tabId)}
                    onCloseAllTabs={() => closeAllTabsInPane("right")}
                    onOpenInOtherPane={(tabId) => openFileInOtherPane("right", tabId)}
                    isSplitView={isSplit}
                    pane="right"
                    scrollTargetHeading={rightPaneScrollHeading}
                    typewriterMode={isTypewriterMode}
                    viewRef={rightEditorViewRef}
                    workspacePath={workspaceState?.activeWorkspace?.path}
                  />
                ) : null}
              </div>
            </div>

            {isRightPanelOpen ? (
              <aside className="right-panel">
                <div className="sidebar-header">
                  <div className="pane-heading">
                    {rightPanelView === "outline"
                      ? t("pane.outline")
                      : rightPanelView === "frontmatter"
                        ? t("pane.frontmatter")
                        : t("pane.links")}
                  </div>
                </div>
                <div className="sidebar-body">
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
                ) : rightPanelView === "frontmatter" ? (
                  activeTabInFocusedPane ? (
                    <div className="frontmatter-panel">
                      <FrontmatterForm
                        candidates={frontmatterCandidates}
                        content={activeTabInFocusedPane.content}
                        key={`fm-panel-${activeTabInFocusedPane.id}`}
                        onChange={(content) => updateTabContent(activeTabInFocusedPane.id, content)}
                        userDefinedFields={userDefinedFields}
                        workspaceTags={workspaceTags.map((tag) => tag.tag)}
                      />
                    </div>
                  ) : (
                    <div className="empty-note">{t("pane.noNotes")}</div>
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
                        <div className="empty-note">{t("common.loading")}</div>
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
            ) : null}
          </div>
        </main>
      </div>

      <footer className="status-bar">
        <span>Relic</span>
        {activeTabInFocusedPane ? (
          <span>
            {t("app.wordCount", {
              chars: activeTabInFocusedPane.content.length,
              words: activeTabInFocusedPane.content.split(/\s+/).filter(Boolean).length
            })}
          </span>
        ) : (
          <span>{t("app.wordCount", { chars: 0, words: 0 })}</span>
        )}
        {featureToggles.git && gitStatus?.initialized && gitStatus.currentBranch ? (
          <span className="status-bar-branch">⎇ {gitStatus.currentBranch}</span>
        ) : null}
      </footer>

      {showCommandPalette ? (
        <CommandPalette commands={commands} onClose={() => setShowCommandPalette(false)} />
      ) : null}

      {showQuickSwitcher ? (
        <QuickSwitcher
          filePaths={existingMarkdownPaths}
          onClose={() => setShowQuickSwitcher(false)}
          onSelect={handleOpenFile}
        />
      ) : null}

      {toastMessage ? (
        <div className={`toast toast--${toastMessage.type}`} onClick={() => setToastMessage(null)}>
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
        Move
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

function collectMarkdownPaths(nodes: WorkspaceTreeNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "file" ? [node.path] : collectMarkdownPaths(node.children)
  );
}
