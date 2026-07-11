import { create } from "zustand";

export type SidebarView = "files" | "settings" | "tools" | "frontmatter" | "chronicle";
export type RightPanelView = "outline" | "links" | "chronicle" | "recovery";

interface UiState {
  activeSidebarView: SidebarView;
  isSidebarOpen: boolean;
  isRightPanelOpen: boolean;
  isTypewriterMode: boolean;
  rightPanelView: RightPanelView;
  selectedChartId: string | null;
  closeSidebar: () => void;
  openSidebar: () => void;
  setSelectedChartId: (chartId: string | null) => void;
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
  selectedChartId: null,
  closeSidebar: () => set({ isSidebarOpen: false }),
  openSidebar: () => set({ isSidebarOpen: true }),
  setSelectedChartId: (chartId) => set({ selectedChartId: chartId }),
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
