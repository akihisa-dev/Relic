import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultGraphDrawTheme } from "../graph/graphTypes";
import type { SphereData } from "./sphereModel";

const forceGraphMocks = vi.hoisted(() => ({
  graph: {} as Record<string, any>
}));

vi.mock("3d-force-graph", () => ({
  default: vi.fn(function () {
    return forceGraphMocks.graph;
  })
}));

import { createSphereRuntime } from "./sphereRuntime";

function sphereData(): SphereData {
  return {
    links: [{ count: 1, source: "A.md", sourceId: "A.md", target: "B.md", targetId: "B.md", type: "link" }],
    nodes: [
      { backlinkCount: 0, baseColor: "#111111", exists: true, id: "A.md", label: "A", linkCount: 1, path: "A.md", type: "file", val: 4 },
      { backlinkCount: 1, baseColor: "#222222", exists: true, id: "B.md", label: "B", linkCount: 0, path: "B.md", type: "file", val: 4 },
      { backlinkCount: 0, baseColor: "#333333", exists: true, id: "C.md", label: "C", linkCount: 0, path: "C.md", type: "file", val: 4 }
    ]
  };
}

describe("sphereRuntime", () => {
  let canvas: HTMLCanvasElement;
  let controls: Record<string, unknown>;
  let observerDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    controls = {};
    observerDisconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", vi.fn(function (callback: () => void) {
      callback();
      return { disconnect: observerDisconnect, observe: vi.fn() };
    }));

    const graph: Record<string, any> = {
      controls: vi.fn(() => controls),
      renderer: vi.fn(() => ({ domElement: canvas, setPixelRatio: vi.fn() }))
    };
    for (const method of [
      "showNavInfo", "enableNodeDrag", "nodeId", "nodeLabel", "nodeVal", "nodeOpacity", "linkOpacity",
      "linkWidth", "nodeColor", "linkColor", "onNodeHover", "onNodeClick", "onNodeRightClick",
      "onBackgroundRightClick", "onEngineStop", "width", "height", "backgroundColor", "nodeResolution",
      "cooldownTicks", "cooldownTime", "graphData", "refresh", "zoomToFit", "pauseAnimation",
      "resumeAnimation", "_destructor"
    ]) {
      graph[method] = vi.fn(() => graph);
    }
    forceGraphMocks.graph = graph;
  });

  it("球状表示の操作制限・描画品質・強調をruntime内へ閉じ込める", () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ height: 600, width: 900 })
    });
    const callbacks = {
      canvasLabel: "スフィア",
      onBackgroundFocusClear: vi.fn(),
      onContextLost: vi.fn(),
      onNodeActivate: vi.fn(),
      onNodeFocus: vi.fn(),
      onNodeHover: vi.fn()
    };
    const runtime = createSphereRuntime(host, callbacks);
    runtime.setData(sphereData(), defaultGraphDrawTheme);
    runtime.setFocus("A.md");

    expect(canvas).toHaveAttribute("aria-label", "スフィア");
    expect(controls).toMatchObject({ enablePan: false, minDistance: 48, maxDistance: 4_800 });
    expect(forceGraphMocks.graph.graphData).toHaveBeenCalled();
    const colorAccessor = forceGraphMocks.graph.nodeColor.mock.calls[0][0];
    const linkWidthAccessor = forceGraphMocks.graph.linkWidth.mock.calls[0][0];
    expect(colorAccessor(sphereData().nodes[0])).toBe(defaultGraphDrawTheme.accent);
    expect(colorAccessor(sphereData().nodes[1])).toBe("#222222");
    expect(colorAccessor(sphereData().nodes[2])).toBe(defaultGraphDrawTheme.border);
    expect(linkWidthAccessor(sphereData().links[0])).toBe(1.3);
    expect(linkWidthAccessor({
      count: 1,
      source: "B.md",
      sourceId: "B.md",
      target: "C.md",
      targetId: "C.md",
      type: "link"
    })).toBe(0.4);

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(callbacks.onContextLost).toHaveBeenCalled();

    runtime.dispose();
    runtime.dispose();
    expect(forceGraphMocks.graph.pauseAnimation).toHaveBeenCalledOnce();
    expect(forceGraphMocks.graph._destructor).toHaveBeenCalledOnce();
    expect(observerDisconnect).toHaveBeenCalledOnce();
  });
});
