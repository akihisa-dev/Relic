import { create } from "zustand";

export type SidebarView = "files" | "ai" | "settings" | "tools" | "frontmatter" | "chronicle" | "calendar";
export type RightPanelView = "outline" | "links";
export type SecondarySidebarView = "none" | "ai-chat";

interface UiState {
  activeSidebarView: SidebarView;
  isSidebarOpen: boolean;
  isSecondarySidebarOpen: boolean;
  isRightPanelOpen: boolean;
  isTypewriterMode: boolean;
  rightPanelView: RightPanelView;
  secondarySidebarView: SecondarySidebarView;
  selectedChartId: string | null;
  closeSecondarySidebar: () => void;
  closeSidebar: () => void;
  openSecondarySidebar: (view: SecondarySidebarView) => void;
  openSidebar: () => void;
  setSelectedChartId: (chartId: string | null) => void;
  setSecondarySidebarView: (view: SecondarySidebarView) => void;
  setSidebarView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  toggleTypewriterMode: () => void;
  setRightPanelView: (view: RightPanelView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeSidebarView: "files",
  isSidebarOpen: true,
  isSecondarySidebarOpen: false,
  isRightPanelOpen: true,
  isTypewriterMode: false,
  rightPanelView: "outline",
  secondarySidebarView: "none",
  selectedChartId: null,
  closeSecondarySidebar: () => set({ isSecondarySidebarOpen: false, secondarySidebarView: "none" }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  openSecondarySidebar: (view) =>
    set({
      isSecondarySidebarOpen: view !== "none",
      secondarySidebarView: view
    }),
  openSidebar: () => set({ isSidebarOpen: true }),
  setSelectedChartId: (chartId) => set({ selectedChartId: chartId }),
  setSecondarySidebarView: (view) =>
    set({
      isSecondarySidebarOpen: view !== "none",
      secondarySidebarView: view
    }),
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
