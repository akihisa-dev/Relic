import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";

import { defaultGraphDrawTheme, type GraphDrawTheme } from "../graph/graphTypes";
import {
  sphereFocusIds,
  sphereLabelNodes,
  sphereLinkTouchesFocus,
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
  addEventListener?: (type: "change", listener: () => void) => void;
  enablePan?: boolean;
  maxDistance?: number;
  maxPolarAngle?: number;
  minDistance?: number;
  minPolarAngle?: number;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export function createSphereRuntime(
  host: HTMLElement,
  callbacks: SphereRuntimeCallbacks
): SphereRuntime {
  let data: SphereData = { links: [], nodes: [] };
  let focusId: string | null = null;
  let focusIds = new Set<string>();
  let theme: GraphDrawTheme = defaultGraphDrawTheme;
  let fitPending = false;
  let disposed = false;

  const graph = new ForceGraph3D(host, {
    controlType: "orbit",
    rendererConfig: { alpha: true, antialias: true, powerPreference: "high-performance" }
  }) as unknown as ForceGraph3DInstance<SphereNode, SphereLink>;
  const labelLayer = document.createElement("div");
  labelLayer.className = "sphere-node-label-layer";
  labelLayer.setAttribute("aria-hidden", "true");
  host.append(labelLayer);
  const labelElements = new Map<string, HTMLSpanElement>();
  let labelNodes: SphereNode[] = [];

  function updateLabelFocus(): void {
    for (const [nodeId, label] of labelElements) {
      label.classList.toggle("sphere-node-label--focus", nodeId === focusId);
      label.classList.toggle(
        "sphere-node-label--neighbor",
        nodeId !== focusId && focusIds.has(nodeId)
      );
    }
  }

  function updateLabelPositions(): void {
    const rect = host.getBoundingClientRect();
    for (const node of labelNodes) {
      const label = labelElements.get(node.id);
      if (!label) continue;
      if (![node.x, node.y, node.z].every((value) => typeof value === "number" && Number.isFinite(value))) {
        label.hidden = true;
        continue;
      }

      const screen = graph.graph2ScreenCoords(node.x!, node.y!, node.z!);
      const visible = screen.x >= -80 && screen.x <= rect.width + 80 &&
        screen.y >= -40 && screen.y <= rect.height + 40;
      label.hidden = !visible;
      if (visible) {
        label.style.transform = `translate3d(${Math.round(screen.x)}px, ${Math.round(screen.y)}px, 0) translate(-50%, calc(-100% - 8px))`;
      }
    }
  }

  function rebuildLabels(): void {
    labelNodes = sphereLabelNodes(data);
    labelElements.clear();
    const fragment = document.createDocumentFragment();
    for (const node of labelNodes) {
      const label = document.createElement("span");
      label.className = "sphere-node-label";
      label.textContent = node.label;
      labelElements.set(node.id, label);
      fragment.append(label);
    }
    labelLayer.replaceChildren(fragment);
    updateLabelFocus();
    updateLabelPositions();
  }

  graph
    .showNavInfo(false)
    .enableNodeDrag(false)
    .nodeId("id")
    .nodeLabel((node) => node.label)
    .nodeVal((node) => node.val)
    .nodeOpacity(0.9)
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
    .onEngineTick(updateLabelPositions)
    .onEngineStop(() => {
      if (!fitPending || data.nodes.length === 0) return;
      fitPending = false;
      graph.zoomToFit(420, 72);
    });

  const controls = graph.controls() as OrbitControlLimits;
  controls.enablePan = false;
  controls.minDistance = 48;
  controls.maxDistance = 4_800;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  const handleControlsChange = () => updateLabelPositions();
  controls.addEventListener?.("change", handleControlsChange);

  const renderer = graph.renderer();
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", callbacks.canvasLabel);
  canvas.setAttribute("tabindex", "0");
  const resize = () => {
    const rect = host.getBoundingClientRect();
    graph.width(Math.max(1, Math.floor(rect.width))).height(Math.max(1, Math.floor(rect.height)));
    updateLabelPositions();
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
      controls.removeEventListener?.("change", handleControlsChange);
      resizeObserver?.disconnect();
      graph.pauseAnimation();
      graph._destructor();
      host.replaceChildren();
    },
    setData: (nextData, nextTheme) => {
      data = nextData;
      theme = nextTheme;
      fitPending = data.nodes.length > 0;
      focusIds = sphereFocusIds(data, focusId);
      const isLarge = data.nodes.length >= 1_500 || data.links.length >= 3_000;
      graph
        .backgroundColor(theme.background)
        .nodeResolution(isLarge ? 4 : 8)
        .cooldownTicks(isLarge ? 90 : 180)
        .cooldownTime(isLarge ? 4_000 : 8_000)
        .graphData(data);
      rebuildLabels();
      renderer.setPixelRatio(isLarge ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      graph.refresh();
    },
    setFocus: (nextFocusId) => {
      focusId = nextFocusId;
      focusIds = sphereFocusIds(data, focusId);
      updateLabelFocus();
      graph.refresh();
    }
  };
}
