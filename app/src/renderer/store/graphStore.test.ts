import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { useGraphStore } from "./graphStore";

const emptyGraph: WorkspaceGraph = { edges: [], nodes: [] };

function resetGraphStore(): void {
  useGraphStore.setState({
    animationEpoch: 0,
    centerForce: 1,
    error: null,
    folderFilter: "",
    graph: null,
    groups: [],
    isLoading: false,
    layoutMode: "standard",
    linkDistance: 118,
    linkFilter: "all",
    linkForce: 1,
    linkThickness: 1,
    loadedWorkspaceId: null,
    localGraphDepth: 0,
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
    zoom: 1
  });
}

function stubGraphApi(getWorkspaceGraph: () => Promise<{ ok: true; value: WorkspaceGraph }>): void {
  window.relic = {
    getWorkspaceGraph
  } as unknown as typeof window.relic;
}

describe("graphStore", () => {
  beforeEach(() => {
    resetGraphStore();
  });

  afterEach(() => {
    resetGraphStore();
    vi.restoreAllMocks();
  });

  it("同一workspaceの読み込み中はgraph取得を重複実行しない", () => {
    const getWorkspaceGraph = vi.fn(() => new Promise<{ ok: true; value: WorkspaceGraph }>(() => undefined));
    stubGraphApi(getWorkspaceGraph);

    useGraphStore.getState().loadGraph("workspace-1");
    useGraphStore.getState().loadGraph("workspace-1");

    expect(getWorkspaceGraph).toHaveBeenCalledTimes(1);
    expect(useGraphStore.getState()).toMatchObject({
      isLoading: true,
      loadedWorkspaceId: "workspace-1"
    });
  });

  it("取得済みgraphがある同一workspaceでは再取得しない", () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({ ok: true, value: emptyGraph });
    stubGraphApi(getWorkspaceGraph);
    useGraphStore.setState({
      graph: emptyGraph,
      isLoading: false,
      loadedWorkspaceId: "workspace-1"
    });

    useGraphStore.getState().loadGraph("workspace-1");

    expect(getWorkspaceGraph).not.toHaveBeenCalled();
  });

  it("force指定では同一workspaceでも再取得する", () => {
    const getWorkspaceGraph = vi.fn().mockResolvedValue({ ok: true, value: emptyGraph });
    stubGraphApi(getWorkspaceGraph);
    useGraphStore.setState({
      graph: emptyGraph,
      isLoading: false,
      loadedWorkspaceId: "workspace-1"
    });

    useGraphStore.getState().loadGraph("workspace-1", true);

    expect(getWorkspaceGraph).toHaveBeenCalledTimes(1);
  });
});
