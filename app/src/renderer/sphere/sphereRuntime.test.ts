import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultGraphDrawTheme } from "../graph/graphTypes";
import { SPHERE_MIN_GUIDE_RADIUS, type SphereData } from "./sphereModel";

const forceGraphMocks = vi.hoisted(() => ({
  graph: {} as Record<string, any>
}));

vi.mock("3d-force-graph", () => ({
  default: vi.fn(function () {
    return forceGraphMocks.graph;
  })
}));

import { createSphereRuntime } from "./sphereRuntime";

type SphereBoundaryForceMock = ((alpha: number) => void) & {
  initialize: (nodes: SphereData["nodes"]) => void;
};

function sphereData(): SphereData {
  return {
    focusIdsByNode: new Map([
      ["A.md", new Set(["A.md", "B.md"])],
      ["B.md", new Set(["A.md", "B.md"])],
      ["C.md", new Set(["C.md"])]
    ]),
    links: [{ count: 1, source: "A.md", sourceId: "A.md", target: "B.md", targetId: "B.md", type: "link" }],
    nodes: [
      { backlinkCount: 0, exists: true, id: "A.md", label: "A", linkCount: 1, path: "A.md", type: "file", val: 4 },
      { backlinkCount: 1, exists: true, id: "B.md", label: "B", linkCount: 0, path: "B.md", type: "file", val: 4 },
      { backlinkCount: 0, exists: true, id: "C.md", label: "C", linkCount: 0, path: "C.md", type: "file", val: 4 }
    ]
  };
}

describe("sphereRuntime", () => {
  let animationFrames: Array<{ callback: FrameRequestCallback; id: number }>;
  let canvas: HTMLCanvasElement;
  let chargeForce: { strength: ReturnType<typeof vi.fn> };
  let controls: Record<string, unknown>;
  let linkForce: { distance: ReturnType<typeof vi.fn> };
  let observerDisconnect: ReturnType<typeof vi.fn>;
  let observerUnobserve: ReturnType<typeof vi.fn>;
  let rendererRender: ReturnType<typeof vi.fn>;
  let scene: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> };

  const runAnimationFrame = () => {
    const frames = animationFrames.splice(0);
    for (const frame of frames) frame.callback(performance.now());
  };

  beforeEach(() => {
    animationFrames = [];
    canvas = document.createElement("canvas");
    chargeForce = { strength: vi.fn() };
    controls = { cursor: { set: vi.fn() } };
    linkForce = { distance: vi.fn() };
    observerDisconnect = vi.fn();
    observerUnobserve = vi.fn();
    rendererRender = vi.fn();
    scene = { add: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = animationFrames.length + 1;
      animationFrames.push({ callback, id });
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => {
      animationFrames = animationFrames.filter((frame) => frame.id !== id);
    }));
    vi.stubGlobal("ResizeObserver", vi.fn(function (callback: () => void) {
      callback();
      return { disconnect: observerDisconnect, observe: vi.fn(), unobserve: observerUnobserve };
    }));

    const graph: Record<string, any> = {
      camera: vi.fn(() => ({ aspect: 1.5, fov: 60 })),
      cameraPosition: vi.fn(() => graph),
      controls: vi.fn(() => controls),
      getGraphBbox: vi.fn(() => ({ x: [-120, 100], y: [-80, 90], z: [-60, 70] })),
      scene: vi.fn(() => scene),
      renderer: vi.fn(() => ({
        domElement: canvas,
        forceContextLoss: vi.fn(),
        render: rendererRender,
        setPixelRatio: vi.fn()
      }))
    };
    for (const method of [
      "showNavInfo", "enableNodeDrag", "nodeId", "nodeLabel", "nodeVal", "nodeOpacity", "linkOpacity",
      "linkVisibility", "linkWidth", "nodeColor", "linkColor", "onNodeHover", "onNodeClick", "onBackgroundClick",
      "onEngineTick", "onEngineStop", "width", "height", "backgroundColor", "nodeResolution",
      "nodeRelSize", "cooldownTicks", "cooldownTime", "graphData", "refresh", "zoomToFit", "pauseAnimation",
      "resumeAnimation", "_destructor"
    ]) {
      graph[method] = vi.fn(() => graph);
    }
    graph.d3Force = vi.fn((name: string, force?: unknown) => {
      if (force !== undefined) return graph;
      if (name === "charge") return chargeForce;
      if (name === "link") return linkForce;
      return undefined;
    });
    forceGraphMocks.graph = graph;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("球状表示の操作制限・描画品質・強調をruntime内へ閉じ込める", () => {
    const host = document.createElement("div");
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ height: 600, width: 900 })
    });
    const callbacks = {
      canvasLabel: "スフィア",
      onBackgroundClick: vi.fn(),
      onContextLost: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeHover: vi.fn()
    };
    const runtime = createSphereRuntime(host, callbacks);
    const data = sphereData();
    Object.assign(data.nodes[0], { x: 10, y: 20, z: 30 });
    Object.assign(data.nodes[1], { x: -20, y: 10, z: 5 });
    Object.assign(data.nodes[2], { x: 5, y: -15, z: -10 });
    runtime.setTheme(defaultGraphDrawTheme, new Map([
      ["A.md", "#111111"], ["B.md", "#222222"], ["C.md", "#333333"]
    ]));
    runtime.setData(data);
    runtime.setFocus("A.md");
    runAnimationFrame();
    runAnimationFrame();
    forceGraphMocks.graph.onEngineTick.mock.calls[0][0]();

    expect(canvas).toHaveAttribute("aria-label", "スフィア");
    expect(controls).toMatchObject({
      enablePan: true,
      maxDistance: 4_800,
      maxTargetRadius: SPHERE_MIN_GUIDE_RADIUS,
      minDistance: 48
    });
    expect(forceGraphMocks.graph.graphData).toHaveBeenCalled();
    expect(forceGraphMocks.graph.linkVisibility).toHaveBeenCalledWith(true);
    expect(forceGraphMocks.graph.linkOpacity).toHaveBeenCalledWith(0.48);
    expect(forceGraphMocks.graph.linkOpacity).toHaveBeenLastCalledWith(0.48);
    const chargeAccessor = chargeForce.strength.mock.calls[0][0];
    const distanceAccessor = linkForce.distance.mock.calls[0][0];
    expect(chargeAccessor(data.nodes[0])).toBe(-60);
    expect(distanceAccessor(data.links[0])).toBe(30);
    expect(forceGraphMocks.graph.nodeRelSize).toHaveBeenCalledWith(expect.any(Number));
    expect(forceGraphMocks.graph.d3Force).toHaveBeenCalledWith("sphere-boundary", expect.any(Function));
    const boundaryForce = forceGraphMocks.graph.d3Force.mock.calls
      .find(([name]: [string]) => name === "sphere-boundary")?.[1] as SphereBoundaryForceMock;
    const boundaryNode = sphereData().nodes[0]!;
    Object.assign(boundaryNode, { vx: 0, vy: 0, vz: 0, x: 1_000, y: 0, z: 0 });
    boundaryForce.initialize([boundaryNode]);
    boundaryForce(1);
    expect(boundaryNode.vx).toBeLessThan(0);
    forceGraphMocks.graph.onEngineStop.mock.calls[0][0]();
    expect(data.nodes[0]).toMatchObject({ x: 10, y: 20, z: 30 });
    expect(forceGraphMocks.graph.cameraPosition).toHaveBeenCalledWith(
      {
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number)
      },
      { x: 0, y: 0, z: 0 },
      420
    );
    const initialCameraPosition = forceGraphMocks.graph.cameraPosition.mock.calls[0][0];
    expect(initialCameraPosition.x).toBeCloseTo(initialCameraPosition.z);
    expect(initialCameraPosition.y).toBeGreaterThan(0);
    expect(initialCameraPosition.x).toBeGreaterThan(initialCameraPosition.y);
    runtime.setData(sphereData());
    runAnimationFrame();
    runAnimationFrame();
    forceGraphMocks.graph.onEngineStop.mock.calls[0][0]();
    expect(forceGraphMocks.graph.cameraPosition).toHaveBeenCalledTimes(2);
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
    expect(linkWidthAccessor(unfocusedLink)).toBe(0);
    expect(linkColorAccessor(sphereData().links[0])).toBe(defaultGraphDrawTheme.accent);
    expect(linkColorAccessor(unfocusedLink)).toBe(defaultGraphDrawTheme.textSecondary);
    forceGraphMocks.graph.onNodeClick.mock.calls[0][0](data.nodes[0]);
    forceGraphMocks.graph.onBackgroundClick.mock.calls[0][0]();
    expect(callbacks.onNodeClick).toHaveBeenCalledWith(data.nodes[0]);
    expect(callbacks.onBackgroundClick).toHaveBeenCalledOnce();

    runtime.resetView();
    expect((controls.cursor as { set: ReturnType<typeof vi.fn> }).set).toHaveBeenCalledWith(0, 0, 0);
    expect(forceGraphMocks.graph.cameraPosition).toHaveBeenCalledWith(
      {
        x: expect.any(Number),
        y: expect.any(Number),
        z: expect.any(Number)
      },
      { x: 0, y: 0, z: 0 },
      420
    );
    const resetCameraPosition = forceGraphMocks.graph.cameraPosition.mock.calls.at(-1)?.[0];
    expect(resetCameraPosition.x).toBeCloseTo(resetCameraPosition.z);
    expect(resetCameraPosition.y).toBeGreaterThan(0);

    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(callbacks.onContextLost).toHaveBeenCalled();

    runtime.dispose();
    runtime.dispose();
    expect(forceGraphMocks.graph.pauseAnimation).toHaveBeenCalledOnce();
    expect(forceGraphMocks.graph._destructor).toHaveBeenCalledOnce();
    expect(forceGraphMocks.graph.renderer.mock.results[0].value.forceContextLoss).toHaveBeenCalledOnce();
    expect(observerDisconnect).toHaveBeenCalledOnce();
    expect(observerUnobserve).toHaveBeenCalledOnce();
    expect(scene.remove).toHaveBeenCalledTimes(2);
  });

  it("中心ガイドを1画面分先に表示してからノード配置を始める", () => {
    const host = document.createElement("div");
    const runtime = createSphereRuntime(host, {
      canvasLabel: "スフィア",
      onBackgroundClick: vi.fn(),
      onContextLost: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeHover: vi.fn()
    });
    const data = sphereData();

    runtime.setData(data);

    expect(scene.add).toHaveBeenCalledOnce();
    expect(forceGraphMocks.graph.graphData).not.toHaveBeenCalled();

    runAnimationFrame();

    expect(forceGraphMocks.graph.graphData).not.toHaveBeenCalledWith(data);

    runAnimationFrame();

    expect(forceGraphMocks.graph.graphData).toHaveBeenLastCalledWith(data);
    runtime.dispose();
  });

  it("ノードの膨張中に同じ中心ガイドを連続して広げる", () => {
    const host = document.createElement("div");
    const runtime = createSphereRuntime(host, {
      canvasLabel: "スフィア",
      onBackgroundClick: vi.fn(),
      onContextLost: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeHover: vi.fn()
    });
    const data = sphereData();

    runtime.setData(data);
    const guideGroup = scene.add.mock.calls[0][0];
    const ring = guideGroup.getObjectByName("sphere-equator-ring") as { geometry: { getAttribute: (name: string) => { getX: (index: number) => number } } };
    const initialRadius = ring.geometry.getAttribute("instanceStart").getX(0);
    runAnimationFrame();
    runAnimationFrame();
    Object.assign(data.nodes[0], { x: 240, y: 0, z: 0 });

    forceGraphMocks.graph.onEngineTick.mock.calls[0][0]();

    expect(scene.add).toHaveBeenCalledOnce();
    expect(scene.remove).not.toHaveBeenCalled();
    expect(ring.geometry.getAttribute("instanceStart").getX(0)).toBeGreaterThan(initialRadius);
    expect(controls.maxTargetRadius).toBeGreaterThan(SPHERE_MIN_GUIDE_RADIUS);

    forceGraphMocks.graph.onEngineStop.mock.calls[0][0]();

    expect(scene.add).toHaveBeenCalledOnce();
    expect(scene.remove).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("破棄した場合は待機中のノード配置を開始しない", () => {
    const host = document.createElement("div");
    const runtime = createSphereRuntime(host, {
      canvasLabel: "スフィア",
      onBackgroundClick: vi.fn(),
      onContextLost: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeHover: vi.fn()
    });
    const data = sphereData();

    runtime.setData(data);
    runtime.dispose();
    runAnimationFrame();
    runAnimationFrame();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(forceGraphMocks.graph.graphData).not.toHaveBeenCalledWith(data);
  });

  it("同一更新を無視し、配置停止後もクリック判定の描画を維持する", () => {
    const host = document.createElement("div");
    const runtime = createSphereRuntime(host, {
      canvasLabel: "スフィア",
      onBackgroundClick: vi.fn(),
      onContextLost: vi.fn(),
      onNodeClick: vi.fn(),
      onNodeHover: vi.fn()
    });
    const data = sphereData();
    runtime.setData(data);
    runtime.setData(data);
    runAnimationFrame();
    runAnimationFrame();
    vi.useFakeTimers();

    expect(forceGraphMocks.graph.graphData.mock.calls.filter(([value]: [unknown]) => value === data)).toHaveLength(1);
    const graphDataCallCount = forceGraphMocks.graph.graphData.mock.calls.length;
    runtime.setTheme(defaultGraphDrawTheme, new Map([["A.md", "#111111"]]));
    expect(forceGraphMocks.graph.graphData).toHaveBeenCalledTimes(graphDataCallCount);

    runtime.setFocus("A.md");
    const refreshCallCount = forceGraphMocks.graph.refresh.mock.calls.length;
    runtime.setFocus("A.md");
    expect(forceGraphMocks.graph.refresh).toHaveBeenCalledTimes(refreshCallCount);

    forceGraphMocks.graph.onEngineStop.mock.calls[0][0]();
    vi.advanceTimersByTime(500);
    expect(forceGraphMocks.graph.pauseAnimation).not.toHaveBeenCalled();

    runtime.dispose();
  });
});
