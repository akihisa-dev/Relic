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
  let scene: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    canvas = document.createElement("canvas");
    controls = {};
    observerDisconnect = vi.fn();
    scene = { add: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("ResizeObserver", vi.fn(function (callback: () => void) {
      callback();
      return { disconnect: observerDisconnect, observe: vi.fn() };
    }));

    const graph: Record<string, any> = {
      controls: vi.fn(() => controls),
      scene: vi.fn(() => scene),
      renderer: vi.fn(() => ({ domElement: canvas, setPixelRatio: vi.fn() }))
    };
    for (const method of [
      "showNavInfo", "enableNodeDrag", "nodeId", "nodeLabel", "nodeVal", "nodeOpacity", "linkOpacity",
      "nodePositionUpdate", "linkVisibility", "linkWidth", "nodeColor", "linkColor", "onNodeHover", "onNodeClick", "onNodeRightClick",
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
    const data = sphereData();
    Object.assign(data.nodes[0], { x: 10, y: 20, z: 30 });
    Object.assign(data.nodes[1], { x: -20, y: 10, z: 5 });
    Object.assign(data.nodes[2], { x: 5, y: -15, z: -10 });
    runtime.setData(data, defaultGraphDrawTheme);
    runtime.setFocus("A.md");

    expect(canvas).toHaveAttribute("aria-label", "スフィア");
    expect(controls).toMatchObject({ enablePan: false, minDistance: 48, maxDistance: 4_800 });
    expect(forceGraphMocks.graph.graphData).toHaveBeenCalled();
    expect(forceGraphMocks.graph.linkVisibility).toHaveBeenCalledWith(true);
    expect(forceGraphMocks.graph.linkOpacity).toHaveBeenCalledWith(0.72);
    const positionAccessor = forceGraphMocks.graph.nodePositionUpdate.mock.calls[0][0];
    const position = { set: vi.fn() };
    expect(positionAccessor({ position }, { x: 10, y: 20, z: 30 }, data.nodes[0])).toBe(false);
    forceGraphMocks.graph.onEngineStop.mock.calls[0][0]();
    expect(positionAccessor({ position }, { x: 10, y: 20, z: 30 }, data.nodes[0])).toBe(true);
    expect(position.set).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expect.any(Number));
    const [pulseX, pulseY, pulseZ] = position.set.mock.calls[0];
    expect(pulseX / pulseY).toBeCloseTo(10 / 20);
    expect(pulseZ / pulseY).toBeCloseTo(30 / 20);
    expect(Math.abs(Math.hypot(pulseX, pulseY, pulseZ) - Math.hypot(10, 20, 30)))
      .toBeLessThanOrEqual(3);
    expect(data.nodes[0]).toMatchObject({ x: pulseX, y: pulseY, z: pulseZ });
    expect(forceGraphMocks.graph.zoomToFit).toHaveBeenCalledWith(420, 72);
    runtime.setData(sphereData(), defaultGraphDrawTheme);
    forceGraphMocks.graph.onEngineStop.mock.calls[0][0]();
    expect(forceGraphMocks.graph.zoomToFit).toHaveBeenCalledTimes(1);
    expect(scene.add).toHaveBeenCalledTimes(2);
    const colorAccessor = forceGraphMocks.graph.nodeColor.mock.calls[0][0];
    const linkColorAccessor = forceGraphMocks.graph.linkColor.mock.calls[0][0];
    const linkWidthAccessor = forceGraphMocks.graph.linkWidth.mock.calls[0][0];
    expect(colorAccessor(sphereData().nodes[0])).toBe(defaultGraphDrawTheme.accent);
    expect(colorAccessor(sphereData().nodes[1])).toBe("#222222");
    expect(colorAccessor(sphereData().nodes[2])).toBe(defaultGraphDrawTheme.border);
    expect(linkWidthAccessor(sphereData().links[0])).toBe(2.4);
    const unfocusedLink = {
      count: 1,
      source: "B.md",
      sourceId: "B.md",
      target: "C.md",
      targetId: "C.md",
      type: "link"
    } as const;
    expect(linkWidthAccessor(unfocusedLink)).toBe(1);
    expect(linkColorAccessor(sphereData().links[0])).toBe(defaultGraphDrawTheme.accent);
    expect(linkColorAccessor(unfocusedLink)).toBe(defaultGraphDrawTheme.textSecondary);

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(callbacks.onContextLost).toHaveBeenCalled();

    runtime.dispose();
    runtime.dispose();
    expect(forceGraphMocks.graph.pauseAnimation).toHaveBeenCalledOnce();
    expect(forceGraphMocks.graph._destructor).toHaveBeenCalledOnce();
    expect(observerDisconnect).toHaveBeenCalledOnce();
    expect(scene.remove).toHaveBeenCalledTimes(2);
  });

  it("アニメーションを減らす設定ではノードを揺らさない", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const host = document.createElement("div");
    const runtime = createSphereRuntime(host, {
      canvasLabel: "スフィア",
      onBackgroundFocusClear: vi.fn(),
      onContextLost: vi.fn(),
      onNodeActivate: vi.fn(),
      onNodeFocus: vi.fn(),
      onNodeHover: vi.fn()
    });
    const positionAccessor = forceGraphMocks.graph.nodePositionUpdate.mock.calls[0][0];
    const position = { set: vi.fn() };

    expect(positionAccessor({ position }, { x: 10, y: 20, z: 30 }, sphereData().nodes[0])).toBe(false);
    expect(position.set).not.toHaveBeenCalled();

    runtime.dispose();
  });
});
