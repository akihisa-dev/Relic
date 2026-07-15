import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";

import { defaultGraphDrawTheme, type GraphDrawTheme } from "../graph/graphTypes";
import { createSphereGuides, type SphereGuides } from "./sphereGuides";
import {
  sphereFocusIds,
  sphereLinkTouchesFocus,
  sphereNodePulsePhase,
  sphereNodePulsePosition,
  type SphereData,
  type SphereLink,
  type SphereNode
} from "./sphereModel";

interface SphereRuntimeCallbacks {
  canvasLabel: string;
  onBackgroundFocusClear: () => void;
  onContextLost: () => void;
  onNodeActivate: (node: SphereNode) => void;
  onNodeFocus: (node: SphereNode) => void;
  onNodeHover: (node: SphereNode | null) => void;
}

export interface SphereRuntime {
  dispose: () => void;
  setData: (data: SphereData, theme: GraphDrawTheme) => void;
  setFocus: (focusId: string | null) => void;
}

type OrbitControlLimits = {
  enablePan?: boolean;
  maxDistance?: number;
  maxPolarAngle?: number;
  minDistance?: number;
  minPolarAngle?: number;
};

export function createSphereRuntime(
  host: HTMLElement,
  callbacks: SphereRuntimeCallbacks
): SphereRuntime {
  let data: SphereData = { links: [], nodes: [] };
  let focusId: string | null = null;
  let focusIds = new Set<string>();
  let theme: GraphDrawTheme = defaultGraphDrawTheme;
  let layoutPending = false;
  let fitPending = false;
  let hasFittedData = false;
  let disposed = false;
  let guides: SphereGuides | null = null;
  let pulseActive = false;
  let pulseBasePositions = new WeakMap<SphereNode, { x: number; y: number; z: number }>();
  const nodePulsePhases = new WeakMap<SphereNode, number>();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;

  const graph = new ForceGraph3D(host, {
    controlType: "orbit",
    rendererConfig: { alpha: true, antialias: true, powerPreference: "high-performance" }
  }) as unknown as ForceGraph3DInstance<SphereNode, SphereLink>;
  const scene = graph.scene();
  const clearGuides = () => {
    if (!guides) return;
    scene.remove(guides.group);
    guides.dispose();
    guides = null;
  };
  graph
    .showNavInfo(false)
    .enableNodeDrag(false)
    .nodeId("id")
    .nodeLabel((node) => node.label)
    .nodeVal((node) => node.val)
    .nodeOpacity(0.9)
    .nodePositionUpdate((nodeObject, _coordinates, node) => {
      if (reducedMotion?.matches || !pulseActive) return false;
      const basePosition = pulseBasePositions.get(node);
      if (!basePosition) return false;
      let phase = nodePulsePhases.get(node);
      if (phase === undefined) {
        phase = sphereNodePulsePhase(node.id);
        nodePulsePhases.set(node, phase);
      }
      const position = sphereNodePulsePosition(basePosition, performance.now(), phase);
      node.x = position.x;
      node.y = position.y;
      node.z = position.z;
      nodeObject.position.set(position.x, position.y, position.z);
      return true;
    })
    .linkVisibility(true)
    .linkOpacity(0.72)
    .linkWidth((link) => {
      return sphereLinkTouchesFocus(link, focusId) ? 2.4 : 1;
    })
    .nodeColor((node) => {
      if (!focusId) return node.baseColor;
      if (node.id === focusId) return theme.accent;
      return focusIds.has(node.id) ? node.baseColor : theme.border;
    })
    .linkColor((link) => focusId && sphereLinkTouchesFocus(link, focusId)
      ? theme.accent
      : theme.textSecondary)
    .onNodeHover((node) => callbacks.onNodeHover(node))
    .onNodeClick((node) => callbacks.onNodeActivate(node))
    .onNodeRightClick((node, event) => {
      event.preventDefault();
      callbacks.onNodeFocus(node);
    })
    .onBackgroundRightClick((event) => {
      event.preventDefault();
      callbacks.onBackgroundFocusClear();
    })
    .onEngineStop(() => {
      if (!layoutPending || data.nodes.length === 0) return;
      layoutPending = false;
      const shouldFit = fitPending;
      fitPending = false;
      pulseBasePositions = new WeakMap();
      let radius = 0;
      for (const node of data.nodes) {
        if (Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)) {
          const position = { x: node.x!, y: node.y!, z: node.z! };
          pulseBasePositions.set(node, position);
          radius = Math.max(radius, Math.hypot(position.x, position.y, position.z));
        }
      }
      clearGuides();
      guides = createSphereGuides(radius, theme.accent);
      scene.add(guides.group);
      pulseActive = true;
      if (shouldFit) {
        hasFittedData = true;
        graph.zoomToFit(420, 72);
      }
    });

  const controls = graph.controls() as OrbitControlLimits;
  controls.enablePan = false;
  controls.minDistance = 48;
  controls.maxDistance = 4_800;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;

  const renderer = graph.renderer();
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", callbacks.canvasLabel);
  canvas.setAttribute("tabindex", "0");
  const resize = () => {
    const rect = host.getBoundingClientRect();
    graph.width(Math.max(1, Math.floor(rect.width))).height(Math.max(1, Math.floor(rect.height)));
  };
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  resizeObserver?.observe(host);
  resize();

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    callbacks.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);

  const handleVisibilityChange = () => {
    if (document.hidden) graph.pauseAnimation();
    else graph.resumeAnimation();
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      resizeObserver?.disconnect();
      clearGuides();
      graph.pauseAnimation();
      graph._destructor();
      host.replaceChildren();
    },
    setData: (nextData, nextTheme) => {
      data = nextData;
      theme = nextTheme;
      layoutPending = data.nodes.length > 0;
      fitPending = data.nodes.length > 0 && !hasFittedData;
      pulseActive = false;
      pulseBasePositions = new WeakMap();
      clearGuides();
      focusIds = sphereFocusIds(data, focusId);
      const isLarge = data.nodes.length >= 1_500 || data.links.length >= 3_000;
      graph
        .backgroundColor(theme.background)
        .nodeResolution(isLarge ? 4 : 8)
        .cooldownTicks(isLarge ? 90 : 180)
        .cooldownTime(isLarge ? 4_000 : 8_000)
        .graphData(data);
      renderer.setPixelRatio(isLarge ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      graph.refresh();
    },
    setFocus: (nextFocusId) => {
      focusId = nextFocusId;
      focusIds = sphereFocusIds(data, focusId);
      graph.refresh();
    }
  };
}
