import { create } from "zustand";

import type { WorkspaceGraph } from "../../shared/ipc";
import type { GraphLayoutMode } from "../graphLayout";

export type GraphLinkFilter = "all" | "linked" | "unlinked";

export interface GraphGroup {
  color: string;
  id: string;
  query: string;
}

interface GraphState {
  error: string | null;
  folderFilter: string;
  graph: WorkspaceGraph | null;
  groups: GraphGroup[];
  animationEpoch: number;
  centerForce: number;
  isLoading: boolean;
  linkFilter: GraphLinkFilter;
  linkForce: number;
  linkDistance: number;
  layoutMode: GraphLayoutMode;
  linkThickness: number;
  localGraphDepth: number;
  loadedWorkspaceId: string | null;
  minDegree: number;
  nodeSize: number;
  query: string;
  repelForce: number;
  selectedPath: string | null;
  showArrows: boolean;
  showLabels: boolean;
  showOrphans: boolean;
  tagFilter: string;
  textFadeThreshold: number;
  zoom: number;
  addGroup: () => void;
  loadGraph: (workspaceId: string | null, force?: boolean) => void;
  removeGroup: (id: string) => void;
  resetFilters: () => void;
  startAnimation: () => void;
  setCenterForce: (value: number) => void;
  setFolderFilter: (value: string) => void;
  setLinkDistance: (value: number) => void;
  setLinkForce: (value: number) => void;
  setLinkFilter: (value: GraphLinkFilter) => void;
  setLayoutMode: (value: GraphLayoutMode) => void;
  setLinkThickness: (value: number) => void;
  setLocalGraphDepth: (value: number) => void;
  setMinDegree: (value: number) => void;
  setNodeSize: (value: number) => void;
  setQuery: (value: string) => void;
  setRepelForce: (value: number) => void;
  setSelectedPath: (value: string | null) => void;
  setShowArrows: (value: boolean) => void;
  setShowLabels: (value: boolean) => void;
  setShowOrphans: (value: boolean) => void;
  setTagFilter: (value: string) => void;
  setTextFadeThreshold: (value: number) => void;
  setZoom: (value: number) => void;
  updateGroup: (id: string, patch: Partial<Omit<GraphGroup, "id">>) => void;
}

const graphGroupColors = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export const useGraphStore = create<GraphState>((set, get) => ({
  error: null,
  folderFilter: "",
  graph: null,
  groups: [],
  animationEpoch: 0,
  centerForce: 1,
  isLoading: false,
  linkDistance: 118,
  linkFilter: "all",
  linkForce: 1,
  layoutMode: "standard",
  linkThickness: 1,
  localGraphDepth: 0,
  loadedWorkspaceId: null,
  minDegree: 0,
  nodeSize: 1,
  query: "",
  repelForce: 1,
  selectedPath: null,
  showArrows: false,
  showLabels: true,
  showOrphans: true,
  tagFilter: "",
  textFadeThreshold: 0.85,
  zoom: 1,
  addGroup: () => set((state) => {
    const color = graphGroupColors[state.groups.length % graphGroupColors.length];
    return {
      groups: [
        ...state.groups,
        { color, id: `graph-group-${Date.now()}-${state.groups.length}`, query: "" }
      ]
    };
  }),
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
    centerForce: 1,
    folderFilter: "",
    groups: [],
    linkDistance: 118,
    linkFilter: "all",
    linkForce: 1,
    layoutMode: "standard",
    linkThickness: 1,
    localGraphDepth: 0,
    minDegree: 0,
    nodeSize: 1,
    query: "",
    repelForce: 1,
    showArrows: false,
    showOrphans: true,
    tagFilter: "",
    textFadeThreshold: 0.85
  }),
  removeGroup: (id) => set((state) => ({ groups: state.groups.filter((group) => group.id !== id) })),
  startAnimation: () => set((state) => ({ animationEpoch: state.animationEpoch + 1 })),
  setCenterForce: (value) => set({ centerForce: value }),
  setFolderFilter: (value) => set({ folderFilter: value }),
  setLinkDistance: (value) => set({ linkDistance: value }),
  setLinkForce: (value) => set({ linkForce: value }),
  setLinkFilter: (value) => set({ linkFilter: value }),
  setLayoutMode: (value) => set({ layoutMode: value }),
  setLinkThickness: (value) => set({ linkThickness: value }),
  setLocalGraphDepth: (value) => set({ localGraphDepth: value }),
  setMinDegree: (value) => set({ minDegree: value }),
  setNodeSize: (value) => set({ nodeSize: value }),
  setQuery: (value) => set({ query: value }),
  setRepelForce: (value) => set({ repelForce: value }),
  setSelectedPath: (value) => set({ selectedPath: value }),
  setShowArrows: (value) => set({ showArrows: value }),
  setShowLabels: (value) => set({ showLabels: value }),
  setShowOrphans: (value) => set({ showOrphans: value }),
  setTagFilter: (value) => set({ tagFilter: value }),
  setTextFadeThreshold: (value) => set({ textFadeThreshold: value }),
  setZoom: (value) => set({ zoom: value }),
  updateGroup: (id, patch) => set((state) => ({
    groups: state.groups.map((group) => group.id === id ? { ...group, ...patch } : group)
  }))
}));
