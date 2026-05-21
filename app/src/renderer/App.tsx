import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { CardbookState } from "../shared/ipc";
import type { AppLinkContextMenu } from "./appLinks";
import {
  openCardPathsForTabs,
  registeredCardbooksForState,
} from "./appShellModel";
import { AppEditorCardbook } from "./components/AppEditorCardbook";
import { AppCardsSidebar } from "./components/AppCardsSidebar";
import { AppOverlays } from "./components/AppOverlays";
import { AppRail } from "./components/AppRail";
import { AppStatusBar } from "./components/AppStatusBar";
import { createTranslator, I18nProvider } from "./i18n";
import { useActiveDocumentContext } from "./hooks/useActiveDocumentContext";
import { useAppKeyboardShortcuts } from "./hooks/useAppKeyboardShortcuts";
import { useAppPaneCardActions } from "./hooks/useAppPaneCardActions";
import { useAppRailNavigation } from "./hooks/useAppRailNavigation";
import { useAppSettingsState } from "./hooks/useAppSettingsState";
import { useAppTabRenderers } from "./hooks/useAppTabRenderers";
import { useAppTheme } from "./hooks/useAppTheme";
import { useAppToast } from "./hooks/useAppToast";
import { useCommandPaletteCommands } from "./hooks/useCommandPaletteCommands";
import { usePaneTabMotion } from "./hooks/usePaneTabMotion";
import { useRailFlights } from "./hooks/useRailFlights";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { useSidebarCardInteractions } from "./hooks/useSidebarCardInteractions";
import { useSplitCloseMotion } from "./hooks/useSplitCloseMotion";
import { useCardbookAliases } from "./hooks/useCardbookAliases";
import { useCardbookCardActions } from "./hooks/useCardbookCardActions";
import { useCardbookTimeline } from "./hooks/useCardbookTimeline";
import { useCardbookRenameRailHold } from "./hooks/useCardbookRenameRailHold";
import { useCardbookSearchState } from "./hooks/useCardbookSearchState";
import { useEditorStore } from "./store/editorStore";
import { useUiStore, type RightPanelView } from "./store/uiStore";
import { collectMarkdownCardPaths } from "./cardbookPaths";
import "./styles.css";

export function App(): ReactElement {
  const [cardbookState, setCardbookState] = useState<CardbookState | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<AppLinkContextMenu | null>(null);
  const { closeToast, isToastClosing, setCardbookError, toastMessage } = useAppToast();
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
  const [cardSearchFocusRequest, setCardSearchFocusRequest] = useState(0);
  const [cardSelectionCount, setCardSelectionCount] = useState(0);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const {
    holdCardbookRailAfterRename,
    isCardbookRenameActive,
    isCardbookRenameHoldingRail,
    setIsCardbookRenameActive
  } = useCardbookRenameRailHold();

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
    openCardInPane,
    openTimelineChartInPane,
    openPanelInPane,
    setEditorSettings,
    setFocusedPane,
    setTabActive,
    toggleTabPinned,
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
  const hasOpenTimeline = useMemo(
    () => Object.values(tabs).some((tab) => tab.kind === "timeline"),
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
    if (isCardbookRenameActive) return;
    toggleSidebarState();
  }, [isCardbookRenameActive, toggleSidebarState]);

  const t = useMemo(() => createTranslator(editorSettings.language), [editorSettings.language]);
  const {
    appInfo,
    featureToggles,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields
  } = useAppSettingsState({
    setEditorSettings,
    setCardbookError,
    setCardbookState
  });

  const {
    frontmatterCandidates,
    frontmatterSearchFields,
    isSearching,
    searchError,
    searchFrontmatterField,
    searchMode,
    searchQuery,
    searchResults,
    setSearchFrontmatterField,
    setSearchMode,
    setSearchQuery
  } = useCardbookSearchState({
    setCardbookError,
    userDefinedFields,
    cardbookState
  });

  const requestCardSearchFocus = useCallback((): void => {
    setSidebarView("cards");
    setCardSearchFocusRequest((current) => current + 1);
  }, [setSidebarView]);

  const existingMarkdownPaths = useMemo(
    () => collectMarkdownCardPaths(cardbookState?.cardTree ?? []),
    [cardbookState?.cardTree]
  );
  const aliasesByPath = useCardbookAliases({ setCardbookError, cardbookState });
  const { timelineCharts, handleUpdateTimelineEntry, reloadTimeline } = useCardbookTimeline({
    hasOpenTimeline,
    setCardbookError,
    tabs,
    updateTabContent,
    cardbookState
  });

  const {
    handleDeleteActiveCard,
    handleDeleteTreeItem,
    handleDeleteTreeItems,
    handleDuplicateActiveCard,
    handleDuplicateTreeCard,
    handleCreateCard,
    handleCreateCardFolder,
    handleCreateNewCardbook,
    handleCreateNoteFromPane,
    handleOpenCard,
    handleOpenMarkdownLink,
    handleOpenWikiLink,
    handleOpenCardbook,
    handleRemoveCardbook,
    handleRenameCardbook,
    handleSwitchCardbook,
    handleMoveCard,
    handleMoveCardFolder,
    handleMoveTreeItems,
    handleRenameTreeItem,
    handleTogglePin,
    isCreatingCard,
    isCreatingCardFolder,
    isCreatingCardbook,
    isOpeningCardbook,
    setIsCreatingCard
  } = useCardbookCardActions({
    aliasesByPath,
    closeAllTabs,
    closeTab,
    existingMarkdownPaths,
    focusedPane,
    leftPane,
    openCardInPane,
    rightPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setCardbookError,
    setCardbookState,
    tabs,
    t,
    updateTabMeta,
    cardbookState
  });

  const {
    handleCreateCardFromSidebar,
    handleCreateCardFolderFromSidebar,
    handleSidebarOpenCard
  } = useSidebarCardInteractions({
    focusedPane,
    handleCreateCard,
    handleCreateCardFolder,
    handleOpenCard,
    openCardInPane,
    setTabActive,
    setCardbookError,
    showRailTabFlight,
    showSidebarCreateFlight,
    t
  });

  const handleCardSaved = useCallback((): void => {
    void reloadTimeline();
  }, [reloadTimeline]);

  const refreshCardbookAfterExternalChange = useCallback(
    async (cardbookId: string): Promise<void> => {
      if (!window.relic) return;
      if (cardbookState?.activeCardbook?.id && cardbookState.activeCardbook.id !== cardbookId) return;

      const result = await window.relic.getCardbookState();
      if (!result.ok) {
        setCardbookError(result.error.message);
        return;
      }

      if (result.value.activeCardbook?.id !== cardbookId) return;

      const nextCardPaths = collectMarkdownCardPaths(result.value.cardTree);
      const nextCardPathSet = new Set(nextCardPaths);

      for (const tabId of leftPane.tabIds) {
        const tab = tabs[tabId];
        if (tab?.kind === "card" && !nextCardPathSet.has(tab.path)) closeTab("left", tabId);
      }

      for (const tabId of rightPane.tabIds) {
        const tab = tabs[tabId];
        if (tab?.kind === "card" && !nextCardPathSet.has(tab.path)) closeTab("right", tabId);
      }

      setCardbookState(result.value);
    },
    [
      closeTab,
      leftPane.tabIds,
      rightPane.tabIds,
      setCardbookError,
      setCardbookState,
      tabs,
      cardbookState?.activeCardbook?.id
    ]
  );

  useEffect(() => {
    if (!window.relic?.onCardbookChanged) return undefined;

    return window.relic.onCardbookChanged((event) => {
      void refreshCardbookAfterExternalChange(event.cardbookId);
    });
  }, [refreshCardbookAfterExternalChange]);

  useAppTheme(editorSettings.theme);

  useAppKeyboardShortcuts({
    closeTab: closeTabWithMotion,
    focusedPane,
    leftPane,
    requestCardSearchFocus,
    rightPane,
    setIsCreatingCard,
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
  const {
    sidebarWidth: rightPanelWidth,
    isSidebarResizing: isRightPanelResizing,
    startSidebarResize: startRightPanelResize
  } = useSidebarResize({
    direction: "left",
    initialWidth: 240,
    maxWidth: 520,
    minWidth: 220
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

  const {
    handleCreateCardInCardFolder,
    handleCreateCardFolderInCardFolder,
    handleDuplicateTabCard,
    handleRevealTabCard,
    handleRevealCardbookItem,
    handleSelectCardFolder,
    openCardInOtherPane,
    openTreeCardInOtherPane,
    openCardbookPathInOtherPane
  } = useAppPaneCardActions({
    focusedPane,
    handleDuplicateTreeCard,
    isSplit,
    openCardInPane,
    openTimelineChartInPane,
    openPanelInPane,
    setLeftPaneScrollHeading,
    setRightPaneScrollHeading,
    setCardbookError,
    setCardbookState,
    t,
    tabs
  });

  const registeredCardbooks = useMemo(
    () => registeredCardbooksForState(cardbookState),
    [cardbookState]
  );
  const pinnedPathSet = useMemo(
    () => new Set(cardbookState?.pinnedPaths ?? []),
    [cardbookState?.pinnedPaths]
  );
  const openCardPathSet = useMemo(
    () => openCardPathsForTabs(tabs),
    [tabs]
  );

  const {
    activeCardTabInFocusedPane,
    backlinks,
    isLoadingBacklinks,
    outlineHeadings,
    outgoingLinks
  } = useActiveDocumentContext({
    aliasesByPath,
    existingMarkdownPaths,
    cardTree: cardbookState?.cardTree,
    focusedPane,
    leftPane,
    rightPane,
    setCardbookError,
    tabs
  });

  const commands = useCommandPaletteCommands({
    activeCardName: activeCardTabInFocusedPane?.name ?? null,
    handleDeleteActiveCard,
    handleDuplicateActiveCard,
    requestCardSearchFocus,
    setIsCreatingCard,
    setShowQuickSwitcher,
    setSidebarView,
    t,
    toggleRightPanel,
    toggleSidebar,
    toggleSplit: toggleSplitWithMotion,
    toggleTypewriterMode
  });

  const {
    activePanelTabIds,
    chartRailView,
    handleRailChartButton,
    handleRailPanelButton,
    isChartTabActive,
    isChartTabOpen,
    openPanelTabIds,
    panelRailViews,
    primaryRailViews,
    renderPanelTabIcon,
    sidebarViews
  } = useAppRailNavigation({
    activeSidebarView,
    clearRailTabFlight,
    closeSidebar,
    featureToggles,
    focusedPane,
    leftPane,
    openTimelineChartInPane,
    openPanelInPane,
    rightPane,
    setSidebarView,
    setTabActive,
    showRailTabFlight,
    t,
    tabs
  });

  const { renderTimelineTab, renderPanelTab } = useAppTabRenderers({
    appInfo,
    editorSettings,
    featureToggles,
    timelineCharts,
    handleOpenCard,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleUpdateTimelineEntry,
    userDefinedFields,
    cardbookState
  });

  // ──────────────────
  // レンダリング
  // ──────────────────

  return (
    <I18nProvider language={editorSettings.language}>
    <div className="app-shell">
      <div className="title-bar" />
      <div className="cardbook">
        <AppRail
          activePanelTabIds={activePanelTabIds}
          activeSidebarView={activeSidebarView}
          activeCardbookId={cardbookState?.activeCardbook?.id ?? null}
          chartRailView={chartRailView}
          isChartTabActive={isChartTabActive}
          isChartTabOpen={isChartTabOpen}
          isSidebarOpen={isSidebarOpen}
          isCardbookRenameActive={isCardbookRenameActive}
          isCardbookRenameHoldingRail={isCardbookRenameHoldingRail}
          onChartButton={handleRailChartButton}
          onCloseSidebar={closeSidebar}
          onPanelButton={handleRailPanelButton}
          onRemoveCardbook={handleRemoveCardbook}
          onRenameActiveChange={setIsCardbookRenameActive}
          onRenameComplete={holdCardbookRailAfterRename}
          onRenameCardbook={handleRenameCardbook}
          onSetSidebarView={setSidebarView}
          onSwitchCardbook={handleSwitchCardbook}
          openPanelTabIds={openPanelTabIds}
          panelRailViews={panelRailViews}
          primaryRailViews={primaryRailViews}
          registeredCardbooks={registeredCardbooks}
          renameLabel={t("cards.rename")}
          removeCardbookLabel={(name) => t("cards.removeCardbook", { name })}
          viewSwitcherLabel={t("nav.viewSwitcher")}
          cardbooksLabel={t("cards.registeredCardbooks")}
        />

        <AppCardsSidebar
          activeSidebarView={activeSidebarView}
          cardSelectionCount={cardSelectionCount}
          isCreatingCard={isCreatingCard}
          isCreatingCardFolder={isCreatingCardFolder}
          isCreatingCardbook={isCreatingCardbook}
          isOpeningCardbook={isOpeningCardbook}
          isSearching={isSearching}
          isSidebarOpen={isSidebarOpen}
          isSidebarResizing={isSidebarResizing}
          onCreateCard={handleCreateCardFromSidebar}
          onCreateCardInCardFolder={handleCreateCardInCardFolder}
          onCreateCardFolder={handleCreateCardFolderFromSidebar}
          onCreateCardFolderInCardFolder={handleCreateCardFolderInCardFolder}
          onCreateCardbook={handleCreateNewCardbook}
          onDeleteItem={handleDeleteTreeItem}
          onDeleteItems={handleDeleteTreeItems}
          onDuplicateCard={handleDuplicateTreeCard}
          onMoveCard={handleMoveCard}
          onMoveCardFolder={handleMoveCardFolder}
          onMoveItems={handleMoveTreeItems}
          onOpenCard={handleSidebarOpenCard}
          onOpenInOtherPane={isSplit ? openTreeCardInOtherPane : undefined}
          onOpenCardbook={handleOpenCardbook}
          onRevealItem={handleRevealCardbookItem}
          onRenameItem={handleRenameTreeItem}
          onSearchFrontmatterFieldChange={setSearchFrontmatterField}
          onSearchModeChange={setSearchMode}
          onSearchQueryChange={setSearchQuery}
          onSelectCardFolder={handleSelectCardFolder}
          onSelectedCountChange={setCardSelectionCount}
          onTogglePin={handleTogglePin}
          openCardPaths={openCardPathSet}
          searchError={searchError}
          searchFocusRequest={cardSearchFocusRequest}
          searchFrontmatterCandidates={frontmatterCandidates}
          searchFrontmatterField={searchFrontmatterField}
          searchFrontmatterFields={frontmatterSearchFields}
          searchMode={searchMode}
          searchQuery={searchQuery}
          searchResults={searchResults}
          selectedCountLabel={t("cards.selectedCount", { count: cardSelectionCount })}
          sidebarViews={sidebarViews}
          sidebarWidth={sidebarWidth}
          startSidebarResize={startSidebarResize}
          cardbookState={cardbookState}
        />

        <AppEditorCardbook
          allCardPaths={existingMarkdownPaths}
          backlinks={backlinks}
          editorActionPulse={editorActionPulse}
          editorSettings={editorSettings}
          focusedPane={focusedPane}
          frontmatterCandidates={frontmatterCandidates}
          isLoadingBacklinks={isLoadingBacklinks}
          isRightPanelOpen={isRightPanelOpen}
          isRightPanelResizing={isRightPanelResizing}
          isSourceMode={isSourceMode}
          isSplit={isSplit}
          isSplitClosing={isSplitClosing}
          isTypewriterMode={isTypewriterMode}
          leftClosingTabIds={leftClosingTabIds}
          leftEditorViewRef={leftEditorViewRef}
          leftPaneScrollHeading={leftPaneScrollHeading}
          onCloseAllTabsInPane={closeAllTabsInPaneWithMotion}
          onCloseOtherTabs={closeOtherTabsWithMotion}
          onCloseTabsToRight={closeTabsToRightWithMotion}
          onCreateCard={handleCreateNoteFromPane}
          onDuplicateTabCard={handleDuplicateTabCard}
          onEditorAction={() => setEditorActionPulse((value) => value + 1)}
          onCardSaved={handleCardSaved}
          onOpenCard={handleOpenCard}
          onOpenInOtherPane={openCardInOtherPane}
          onOpenLink={handleOpenMarkdownLink}
          onOpenWikiLink={handleOpenWikiLink}
          onOutlineHeadingClick={(heading) => {
            const setScrollHeading = focusedPane === "left" ? setLeftPaneScrollHeading : setRightPaneScrollHeading;
            setScrollHeading(heading);
          }}
          onRenameCard={(path, name) => handleRenameTreeItem(path, "card", name)}
          onRevealTabCard={handleRevealTabCard}
          onRightPanelResizeStart={startRightPanelResize}
          onRightPanelViewButton={handleRightPanelViewButton}
          onScrollTargetHandled={(pane) => {
            if (pane === "left") {
              setLeftPaneScrollHeading(undefined);
              return;
            }

            setRightPaneScrollHeading(undefined);
          }}
          onSetFocusedPane={setFocusedPane}
          onSourceModeToggle={() => setIsSourceMode((value) => !value)}
          onSplitToggle={toggleSplitWithMotion}
          onTabClose={closeTabWithMotion}
          onTabMove={moveTab}
          onTabSelect={setTabActive}
          onTogglePinTab={toggleTabPinned}
          outlineHeadings={outlineHeadings}
          outgoingLinks={outgoingLinks}
          renderTimelineTab={renderTimelineTab}
          renderPanelTab={renderPanelTab}
          renderPanelTabIcon={renderPanelTabIcon}
          rightClosingTabIds={rightClosingTabIds}
          rightEditorViewRef={rightEditorViewRef}
          rightPaneScrollHeading={rightPaneScrollHeading}
          rightPanelView={rightPanelView}
          rightPanelWidth={rightPanelWidth}
          setLinkContextMenu={setLinkContextMenu}
          showRightPanelControls={featureToggles.rightPanel}
          userDefinedFields={userDefinedFields}
          cardbookPath={cardbookState?.activeCardbook?.path}
        />
      </div>

      <AppStatusBar activeCardTab={activeCardTabInFocusedPane} />

      <AppOverlays
        aliasesByPath={aliasesByPath}
        closeToast={closeToast}
        commands={commands}
        existingMarkdownPaths={existingMarkdownPaths}
        handleOpenCard={handleOpenCard}
        handleOpenWikiLink={handleOpenWikiLink}
        handleRevealCardbookItem={handleRevealCardbookItem}
        isSplit={isSplit}
        isToastClosing={isToastClosing}
        linkContextMenu={linkContextMenu}
        openCardbookPathInOtherPane={openCardbookPathInOtherPane}
        railTabFlight={railTabFlight}
        setLinkContextMenu={setLinkContextMenu}
        setShowCommandPalette={setShowCommandPalette}
        setShowQuickSwitcher={setShowQuickSwitcher}
        showCommandPalette={showCommandPalette}
        showQuickSwitcher={showQuickSwitcher}
        sidebarCreateFlight={sidebarCreateFlight}
        toastMessage={toastMessage}
      />
    </div>
    </I18nProvider>
  );
}
