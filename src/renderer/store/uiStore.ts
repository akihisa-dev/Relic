import { create } from "zustand";

export type SidebarView = "files" | "search" | "git" | "settings";
export type RightPanelView = "outline" | "links";

interface UiState {
  activeSidebarView: SidebarView;
  isSidebarOpen: boolean;
  isRightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setRightPanelView: (view: RightPanelView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeSidebarView: "files",
  isSidebarOpen: true,
  isRightPanelOpen: true,
  rightPanelView: "outline",
  setSidebarView: (view) =>
    set({
      activeSidebarView: view,
      isSidebarOpen: true
    }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelView: (view) =>
    set({
      rightPanelView: view,
      isRightPanelOpen: true
    })
}));
