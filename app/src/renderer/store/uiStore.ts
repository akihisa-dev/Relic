import { create } from "zustand";

export type SidebarView = "files" | "search" | "graph" | "git" | "settings" | "tools" | "frontmatter" | "chronicle";
export type RightPanelView = "outline" | "links";

interface UiState {
  activeSidebarView: SidebarView;
  isSidebarOpen: boolean;
  isRightPanelOpen: boolean;
  isTypewriterMode: boolean;
  rightPanelView: RightPanelView;
  closeSidebar: () => void;
  openSidebar: () => void;
  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleTypewriterMode: () => void;
  setRightPanelView: (view: RightPanelView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeSidebarView: "files",
  isSidebarOpen: true,
  isRightPanelOpen: true,
  isTypewriterMode: false,
  rightPanelView: "outline",
  closeSidebar: () => set({ isSidebarOpen: false }),
  openSidebar: () => set({ isSidebarOpen: true }),
  setSidebarView: (view) =>
    set({
      activeSidebarView: view,
      isSidebarOpen: true
    }),
  toggleTypewriterMode: () => set((state) => ({ isTypewriterMode: !state.isTypewriterMode })),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  setRightPanelView: (view) =>
    set({
      rightPanelView: view,
      isRightPanelOpen: true
    })
}));
