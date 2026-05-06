import { create } from "zustand";

export type SidebarView = "files" | "search" | "git" | "settings" | "tools";
export type RightPanelView = "outline" | "links";

interface UiState {
  activeSidebarView: SidebarView;
  isFocusMode: boolean;
  isSidebarOpen: boolean;
  isRightPanelOpen: boolean;
  isTypewriterMode: boolean;
  rightPanelView: RightPanelView;
  setSidebarView: (view: SidebarView) => void;
  toggleFocusMode: () => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleTypewriterMode: () => void;
  setRightPanelView: (view: RightPanelView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeSidebarView: "files",
  isFocusMode: false,
  isSidebarOpen: true,
  isRightPanelOpen: true,
  isTypewriterMode: false,
  rightPanelView: "outline",
  setSidebarView: (view) =>
    set({
      activeSidebarView: view,
      isSidebarOpen: true
    }),
  toggleFocusMode: () =>
    set((state) => ({
      isFocusMode: !state.isFocusMode,
      isSidebarOpen: state.isFocusMode,
      isRightPanelOpen: state.isFocusMode
    })),
  toggleTypewriterMode: () => set((state) => ({ isTypewriterMode: !state.isTypewriterMode })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelView: (view) =>
    set({
      rightPanelView: view,
      isRightPanelOpen: true
    })
}));
