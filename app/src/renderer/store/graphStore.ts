import { create } from "zustand";

import type { WorkspaceGraph } from "../../shared/ipc";

export type GraphLinkFilter = "all" | "linked" | "unlinked";

interface GraphState {
  error: string | null;
  folderFilter: string;
  graph: WorkspaceGraph | null;
  isLoading: boolean;
  linkFilter: GraphLinkFilter;
  loadedWorkspaceId: string | null;
  minDegree: number;
  query: string;
  selectedPath: string | null;
  showLabels: boolean;
  tagFilter: string;
  zoom: number;
  loadGraph: (workspaceId: string | null, force?: boolean) => void;
  resetFilters: () => void;
  setFolderFilter: (value: string) => void;
  setLinkFilter: (value: GraphLinkFilter) => void;
  setMinDegree: (value: number) => void;
  setQuery: (value: string) => void;
  setSelectedPath: (value: string | null) => void;
  setShowLabels: (value: boolean) => void;
  setTagFilter: (value: string) => void;
  setZoom: (value: number) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  error: null,
  folderFilter: "",
  graph: null,
  isLoading: false,
  linkFilter: "all",
  loadedWorkspaceId: null,
  minDegree: 0,
  query: "",
  selectedPath: null,
  showLabels: true,
  tagFilter: "",
  zoom: 1,
  loadGraph: (workspaceId, force = false) => {
    if (!window.relic || !workspaceId) {
      set({ error: null, graph: null, isLoading: false, loadedWorkspaceId: null, selectedPath: null });
      return;
    }

    const current = get();
    if (!force && current.loadedWorkspaceId === workspaceId && current.graph) return;

    set({ error: null, isLoading: true, loadedWorkspaceId: workspaceId });
    void window.relic.getWorkspaceGraph().then((result) => {
      if (get().loadedWorkspaceId !== workspaceId) return;
      if (result.ok) {
        set({ graph: result.value, isLoading: false });
      } else {
        set({ error: result.error.message, graph: null, isLoading: false });
      }
    });
  },
  resetFilters: () => set({
    folderFilter: "",
    linkFilter: "all",
    minDegree: 0,
    query: "",
    tagFilter: ""
  }),
  setFolderFilter: (value) => set({ folderFilter: value }),
  setLinkFilter: (value) => set({ linkFilter: value }),
  setMinDegree: (value) => set({ minDegree: value }),
  setQuery: (value) => set({ query: value }),
  setSelectedPath: (value) => set({ selectedPath: value }),
  setShowLabels: (value) => set({ showLabels: value }),
  setTagFilter: (value) => set({ tagFilter: value }),
  setZoom: (value) => set({ zoom: value })
}));
