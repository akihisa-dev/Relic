import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceGraph } from "../../shared/ipc";
import { buildGraphViewBox } from "../graphLayout";
import { useGraphStore } from "../store/graphStore";
import { useGraphPanelModel } from "./useGraphPanelModel";

const graph: WorkspaceGraph = {
  edges: [
    { sourcePath: "Alpha.md", targetPath: "folder/Beta.md" },
    { sourcePath: "folder/Beta.md", targetPath: "Gamma.md" }
  ],
  nodes: [
    { folder: "", name: "Alpha", path: "Alpha.md", tags: ["資料"] },
    { folder: "folder", name: "Beta", path: "folder/Beta.md", tags: ["作業"] },
    { folder: "", name: "Gamma", path: "Gamma.md", tags: [] }
  ]
};

function resetGraphStore(overrides: Partial<ReturnType<typeof useGraphStore.getState>> = {}): void {
  useGraphStore.setState({
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
    zoom: 1,
    ...overrides
  });
}

function renderGraphPanelModel(overrides: Partial<Parameters<typeof useGraphPanelModel>[0]> = {}) {
  const onOpenFile = vi.fn();
  const hook = renderHook((props: Parameters<typeof useGraphPanelModel>[0]) => useGraphPanelModel(props), {
    initialProps: {
      activeFilePath: null,
      onOpenFile,
      workspaceId: "workspace-1",
      ...overrides
    }
  });

  return { hook, onOpenFile };
}

describe("useGraphPanelModel", () => {
  beforeEach(() => {
    window.relic = {
      getWorkspaceGraph: vi.fn().mockResolvedValue({ ok: true, value: graph })
    } as unknown as typeof window.relic;
    resetGraphStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("workspaceIdありで既存通りgraph読込を呼ぶ", async () => {
    renderGraphPanelModel();

    await waitFor(() => {
      expect(window.relic?.getWorkspaceGraph).toHaveBeenCalledTimes(1);
    });
  });

  it("storeのfilter状態からfilteredGraphを導出する", () => {
    resetGraphStore({
      folderFilter: "folder",
      graph,
      loadedWorkspaceId: "workspace-1"
    });

    const { hook } = renderGraphPanelModel();

    expect(hook.result.current.filteredGraph.nodes.map((node) => node.path)).toEqual(["folder/Beta.md"]);
    expect(hook.result.current.filteredGraph.edges).toEqual([]);
  });

  it("hoverではfocusedPathとmotionPathを変更しない", () => {
    resetGraphStore({
      graph,
      loadedWorkspaceId: "workspace-1",
      selectedPath: "Alpha.md"
    });
    const { hook } = renderGraphPanelModel();

    expect(hook.result.current.focusedPath).toBe("Alpha.md");

    hook.result.current.graphCanvas.nodeHandlers.onPointerEnter("folder/Beta.md");
    hook.result.current.graphCanvas.nodeHandlers.onPointerLeave("folder/Beta.md");

    expect(hook.result.current.focusedPath).toBe("Alpha.md");
    expect(hook.result.current.motionPath).toBeNull();
    expect(hook.result.current.isMotionAfterglow).toBe(false);
    expect(hook.result.current.motionEpoch).toBe(0);
  });

  it("showLabels=falseのときlabelOpacityが0になる", () => {
    resetGraphStore({
      graph,
      loadedWorkspaceId: "workspace-1",
      showLabels: false,
      zoom: 1.5
    });

    const { hook } = renderGraphPanelModel();

    expect(hook.result.current.labelOpacity).toBe(0);
  });

  it("force設定と表示設定がgraphCanvas / GraphCanvas用に維持される", async () => {
    resetGraphStore({
      centerForce: 1.4,
      graph,
      linkDistance: 150,
      linkForce: 1.2,
      linkThickness: 1.7,
      loadedWorkspaceId: "workspace-1",
      nodeSize: 1.3,
      repelForce: 1.8,
      selectedPath: "Alpha.md",
      showArrows: true,
      showLabels: true,
      zoom: 1.5
    });

    const { hook } = renderGraphPanelModel();

    await waitFor(() => {
      expect(hook.result.current.graphCanvas.points).toHaveLength(3);
    });
    expect(hook.result.current).toMatchObject({
      linkThickness: 1.7,
      nodeSize: 1.3,
      selectedPath: "Alpha.md",
      showArrows: true,
      showLabels: true
    });
    const expectedViewBox = buildGraphViewBox(1.5, { x: 0, y: 0 }, hook.result.current.graphCanvas.points);
    expect(hook.result.current.graphCanvas.viewBox.width).toBeCloseTo(expectedViewBox.width);
    expect(hook.result.current.graphCanvas.viewBox.height).toBeCloseTo(expectedViewBox.height);
  });
});
