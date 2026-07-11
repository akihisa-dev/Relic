import { useEditorStore } from "./store/editorStore";
import { useUiStore } from "./store/uiStore";

type EditorStoreState = ReturnType<typeof useEditorStore.getState>;
type UiStoreState = ReturnType<typeof useUiStore.getState>;

export function selectAppEditorStoreState(state: EditorStoreState) {
  return {
    closeAllTabs: state.closeAllTabs,
    closeAllTabsInPane: state.closeAllTabsInPane,
    closeOtherTabs: state.closeOtherTabs,
    closeTab: state.closeTab,
    closeTabsToRight: state.closeTabsToRight,
    editorSettings: state.editorSettings,
    focusedPane: state.focusedPane,
    isSplit: state.isSplit,
    leftPane: state.leftPane,
    markTabSaved: state.markTabSaved,
    moveTab: state.moveTab,
    openChartInPane: state.openChartInPane,
    openFileInPane: state.openFileInPane,
    openImageInPane: state.openImageInPane,
    openPdfInPane: state.openPdfInPane,
    openPanelInPane: state.openPanelInPane,
    rightPane: state.rightPane,
    setEditorSettings: state.setEditorSettings,
    setFocusedPane: state.setFocusedPane,
    setTabActive: state.setTabActive,
    setTabExternalConflict: state.setTabExternalConflict,
    tabs: state.tabs,
    toggleSplit: state.toggleSplit,
    toggleTabPinned: state.toggleTabPinned,
    updateTabContent: state.updateTabContent,
    updateTabFromExternal: state.updateTabFromExternal,
    updateTabMeta: state.updateTabMeta
  };
}

export function selectAppUiStoreState(state: UiStoreState) {
  return {
    activeSidebarView: state.activeSidebarView,
    closeSidebar: state.closeSidebar,
    isRightPanelOpen: state.isRightPanelOpen,
    isSidebarOpen: state.isSidebarOpen,
    isTypewriterMode: state.isTypewriterMode,
    rightPanelView: state.rightPanelView,
    setRightPanelView: state.setRightPanelView,
    setSidebarView: state.setSidebarView,
    toggleRightPanel: state.toggleRightPanel,
    toggleSidebar: state.toggleSidebar,
    toggleTypewriterMode: state.toggleTypewriterMode
  };
}
