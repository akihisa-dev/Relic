import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";
import type { Object3D } from "three";

import { defaultGraphDrawTheme, type GraphDrawTheme } from "../graph/graphTypes";
import {
  createSphereGuides,
  type SphereGuides
} from "./sphereGuides";
import {
  SPHERE_MIN_GUIDE_RADIUS,
  sphereCoreRadius,
  sphereFocusIds,
  sphereLayoutSettings,
  sphereLinkDistance,
  sphereLinkTouchesFocus,
  sphereNodeChargeStrength,
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
  attach: (host: HTMLElement) => void;
  dispose: () => void;
  setData: (data: SphereData) => void;
  setCallbacks: (callbacks: SphereRuntimeCallbacks) => void;
  setFocus: (focusId: string | null) => void;
  setTheme: (theme: GraphDrawTheme, nodeColors: ReadonlyMap<string, string>) => void;
  suspend: () => void;
}

type OrbitControlLimits = {
  addEventListener?: (type: "end" | "start", listener: () => void) => void;
  enablePan?: boolean;
  maxDistance?: number;
  maxPolarAngle?: number;
  minDistance?: number;
  minPolarAngle?: number;
  removeEventListener?: (type: "end" | "start", listener: () => void) => void;
};

type ConfigurableChargeForce = {
  strength: (value: number | ((node: SphereNode) => number)) => unknown;
};

type ConfigurableLinkForce = {
  distance: (value: number | ((link: SphereLink) => number)) => unknown;
};

type SphereBoundaryForce = ((alpha: number) => void) & {
  initialize: (nodes: SphereNode[]) => void;
};

function createSphereBoundaryForce(radius: number): SphereBoundaryForce {
  let nodes: SphereNode[] = [];
  const force = ((alpha: number) => {
    for (const node of nodes) {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.z)) continue;
      const distance = Math.hypot(node.x!, node.y!, node.z!);
      if (distance <= radius || distance === 0) continue;
      const pull = ((distance - radius) / distance) * 0.12 * alpha;
      node.vx = (Number.isFinite(node.vx) ? node.vx! : 0) - node.x! * pull;
      node.vy = (Number.isFinite(node.vy) ? node.vy! : 0) - node.y! * pull;
      node.vz = (Number.isFinite(node.vz) ? node.vz! : 0) - node.z! * pull;
    }
  }) as SphereBoundaryForce;
  force.initialize = (nextNodes) => {
    nodes = nextNodes;
  };
  return force;
}

export function createSphereRuntime(
  host: HTMLElement,
  initialCallbacks: SphereRuntimeCallbacks
): SphereRuntime {
  let callbacks = initialCallbacks;
  let currentHost = host;
  let data: SphereData = { focusIdsByNode: new Map(), links: [], nodes: [] };
  let focusId: string | null = null;
  let focusIds = new Set<string>();
  let theme: GraphDrawTheme = defaultGraphDrawTheme;
  let nodeColors: ReadonlyMap<string, string> = new Map();
  let layoutPending = false;
  let fitPending = false;
  let hasFittedData = false;
  let hasRenderedData = false;
  let disposed = false;
  let guides: SphereGuides | null = null;
  let guideRadius = SPHERE_MIN_GUIDE_RADIUS;
  let nodeDataFrame: number | null = null;
  let resizeFrame: number | null = null;
  let idlePulseTimer: number | null = null;
  let idleTransitionTimer: number | null = null;
  let interactionActive = false;
  let animationPaused = false;
  let pulseActive = false;
  let pulseBasePositions = new WeakMap<SphereNode, { x: number; y: number; z: number }>();
  let nodeObjects = new WeakMap<SphereNode, Object3D>();
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
  const cancelNodeDataFrame = () => {
    if (nodeDataFrame === null) return;
    cancelAnimationFrame(nodeDataFrame);
    nodeDataFrame = null;
  };
  const clearIdleTimers = () => {
    if (idlePulseTimer !== null) window.clearTimeout(idlePulseTimer);
    if (idleTransitionTimer !== null) window.clearTimeout(idleTransitionTimer);
    idlePulseTimer = null;
    idleTransitionTimer = null;
  };
  const pauseAnimation = () => {
    if (animationPaused) return;
    graph.pauseAnimation();
    animationPaused = true;
  };
  const resumeAnimation = () => {
    clearIdleTimers();
    if (!animationPaused) return;
    graph.resumeAnimation();
    animationPaused = false;
  };
  const updatePulsePositions = () => {
    if (reducedMotion?.matches || !pulseActive) return;
    const elapsed = performance.now();
    for (const node of data.nodes) {
      const nodeObject = nodeObjects.get(node);
      const basePosition = pulseBasePositions.get(node);
      if (!nodeObject || !basePosition) continue;
      let phase = nodePulsePhases.get(node);
      if (phase === undefined) {
        phase = sphereNodePulsePhase(node.id);
        nodePulsePhases.set(node, phase);
      }
      const position = sphereNodePulsePosition(basePosition, elapsed, phase);
      node.x = position.x;
      node.y = position.y;
      node.z = position.z;
      nodeObject.position.set(position.x, position.y, position.z);
    }
  };
  const renderStaticFrame = () => {
    if (disposed || document.hidden) return;
    renderer.render(scene, graph.camera());
  };
  const scheduleIdlePulse = () => {
    if (
      idlePulseTimer !== null || disposed || document.hidden ||
      interactionActive || layoutPending || reducedMotion?.matches
    ) return;
    idlePulseTimer = window.setTimeout(() => {
      idlePulseTimer = null;
      if (disposed || interactionActive || layoutPending || document.hidden) return;
      requestAnimationFrame(() => {
        if (disposed || interactionActive || layoutPending || document.hidden) return;
        updatePulsePositions();
        renderStaticFrame();
        scheduleIdlePulse();
      });
    }, 100);
  };
  const enterIdle = () => {
    if (disposed || interactionActive || layoutPending || document.hidden) return;
    pauseAnimation();
    renderStaticFrame();
    scheduleIdlePulse();
  };
  const scheduleIdle = (delayMs: number) => {
    if (idleTransitionTimer !== null) window.clearTimeout(idleTransitionTimer);
    idleTransitionTimer = window.setTimeout(() => {
      idleTransitionTimer = null;
      enterIdle();
    }, delayMs);
  };
  const showGuidesBeforeNodes = () => {
    if (data.nodes.length === 0) return;
    guideRadius = SPHERE_MIN_GUIDE_RADIUS;
    guides = createSphereGuides(guideRadius, theme.accent);
    scene.add(guides.group);
  };
  const followLayoutRadius = () => {
    if (!guides) return;
    const targetRadius = sphereCoreRadius(data.nodes);
    guideRadius += (targetRadius - guideRadius) * 0.18;
    guides.setRadius(guideRadius);
  };
  const scheduleNodeData = () => {
    nodeDataFrame = requestAnimationFrame(() => {
      nodeDataFrame = requestAnimationFrame(() => {
        nodeDataFrame = null;
        if (disposed) return;
        layoutPending = data.nodes.length > 0;
        graph.graphData(data);
        hasRenderedData = data.nodes.length > 0;
      });
    });
  };
  graph
    .showNavInfo(false)
    .enableNodeDrag(false)
    .nodeId("id")
    .nodeLabel((node) => node.label)
    .nodeVal((node) => node.val)
    .nodeOpacity(0.9)
    .nodePositionUpdate((nodeObject, _coordinates, node) => {
      nodeObjects.set(node, nodeObject);
      if (reducedMotion?.matches || !pulseActive || interactionActive) return false;
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
    .linkOpacity(0.48)
    .linkWidth((link) => {
      return sphereLinkTouchesFocus(link, focusId) ? 2.4 : 0;
    })
    .nodeColor((node) => {
      const baseColor = nodeColors.get(node.id) ?? theme.textSecondary;
      if (!focusId) return baseColor;
      if (node.id === focusId) return theme.accent;
      return focusIds.has(node.id) ? baseColor : theme.border;
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
    .onEngineTick(() => {
      if (!layoutPending || !guides) return;
      followLayoutRadius();
    })
    .onEngineStop(() => {
      if (!layoutPending || data.nodes.length === 0) return;
      layoutPending = false;
      const shouldFit = fitPending;
      fitPending = false;
      pulseBasePositions = new WeakMap();
      for (const node of data.nodes) {
        if (Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)) {
          const position = { x: node.x!, y: node.y!, z: node.z! };
          pulseBasePositions.set(node, position);
        }
      }
      followLayoutRadius();
      pulseActive = true;
      if (shouldFit) {
        hasFittedData = true;
        graph.zoomToFit(420, 72);
      }
      scheduleIdle(shouldFit ? 500 : 0);
    });

  const controls = graph.controls() as OrbitControlLimits;
  controls.enablePan = false;
  controls.minDistance = 48;
  controls.maxDistance = 4_800;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  const handleControlStart = () => {
    interactionActive = true;
    resumeAnimation();
  };
  const handleControlEnd = () => {
    interactionActive = false;
    if (!layoutPending) scheduleIdle(120);
  };
  controls.addEventListener?.("start", handleControlStart);
  controls.addEventListener?.("end", handleControlEnd);

  const renderer = graph.renderer();
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-label", callbacks.canvasLabel);
  canvas.setAttribute("tabindex", "0");
  let lastWidth = 0;
  let lastHeight = 0;
  const applyResize = () => {
    resizeFrame = null;
    const rect = currentHost.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    if (width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    graph.width(width).height(height);
    if (animationPaused) renderStaticFrame();
  };
  const resize = () => {
    if (resizeFrame !== null) return;
    resizeFrame = requestAnimationFrame(applyResize);
  };
  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  resizeObserver?.observe(currentHost);
  resize();

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    callbacks.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", handleContextLost);

  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearIdleTimers();
      pauseAnimation();
    } else if (layoutPending || interactionActive) {
      resumeAnimation();
    } else {
      enterIdle();
    }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    attach: (nextHost) => {
      if (disposed || nextHost === currentHost) return;
      resizeObserver?.unobserve(currentHost);
      nextHost.append(...currentHost.childNodes);
      currentHost = nextHost;
      lastWidth = 0;
      lastHeight = 0;
      resizeObserver?.observe(currentHost);
      resize();
      if (layoutPending || interactionActive) resumeAnimation();
      else enterIdle();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      controls.removeEventListener?.("start", handleControlStart);
      controls.removeEventListener?.("end", handleControlEnd);
      resizeObserver?.unobserve(currentHost);
      resizeObserver?.disconnect();
      cancelNodeDataFrame();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      clearIdleTimers();
      clearGuides();
      pauseAnimation();
      graph
        .nodeLabel("")
        .nodeVal(1)
        .nodePositionUpdate(() => false)
        .nodeColor(theme.textSecondary)
        .linkColor(theme.border)
        .linkWidth(0)
        .onNodeHover(() => undefined)
        .onNodeClick(() => undefined)
        .onNodeRightClick(() => undefined)
        .onBackgroundRightClick(() => undefined)
        .onEngineTick(() => undefined)
        .onEngineStop(() => undefined);
      graph.d3Force("sphere-boundary", null);
      graph.d3Force("link", null);
      graph.d3Force("charge", null);
      renderer.forceContextLoss();
      graph._destructor();
      currentHost.replaceChildren();
    },
    setData: (nextData) => {
      if (nextData === data) return;
      resumeAnimation();
      const shouldClearRenderedData = hasRenderedData;
      data = nextData;
      layoutPending = false;
      pulseActive = false;
      pulseBasePositions = new WeakMap();
      nodeObjects = new WeakMap();
      cancelNodeDataFrame();
      if (shouldClearRenderedData) {
        graph.graphData({ links: [], nodes: [] });
        hasRenderedData = false;
      }
      const hasCompleteCoordinates = data.nodes.length > 0 && data.nodes.every((node) => (
        Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z)
      ));
      if (data.nodes.length > 0 && !hasCompleteCoordinates) hasFittedData = false;
      fitPending = data.nodes.length > 0 && !hasFittedData;
      clearGuides();
      showGuidesBeforeNodes();
      focusIds = sphereFocusIds(data, focusId);
      const isLarge = data.nodes.length >= 1_500 || data.links.length >= 3_000;
      const layoutSettings = sphereLayoutSettings(data.nodes.length, data.links.length);
      const nodesById = new Map(data.nodes.map((node) => [node.id, node]));
      const chargeForce = graph.d3Force("charge") as ConfigurableChargeForce | undefined;
      const linkForce = graph.d3Force("link") as ConfigurableLinkForce | undefined;
      chargeForce?.strength((node) => sphereNodeChargeStrength(node, layoutSettings));
      linkForce?.distance((link) => {
        const source = typeof link.source === "string" ? nodesById.get(link.source) : link.source;
        const target = typeof link.target === "string" ? nodesById.get(link.target) : link.target;
        return sphereLinkDistance(source, target, layoutSettings);
      });
      graph.d3Force("sphere-boundary", createSphereBoundaryForce(layoutSettings.boundaryRadius));
      graph
        .linkOpacity(layoutSettings.linkOpacity)
        .nodeRelSize(layoutSettings.nodeRelSize)
        .nodeResolution(isLarge ? 4 : 8)
        .cooldownTicks(isLarge ? 90 : 180)
        .cooldownTime(isLarge ? 4_000 : 8_000);
      renderer.setPixelRatio(isLarge ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      if (data.nodes.length > 0) scheduleNodeData();
      else enterIdle();
    },
    setFocus: (nextFocusId) => {
      if (nextFocusId === focusId) return;
      focusId = nextFocusId;
      focusIds = sphereFocusIds(data, focusId);
      graph.refresh();
      if (animationPaused) renderStaticFrame();
    },
    setCallbacks: (nextCallbacks) => {
      callbacks = nextCallbacks;
      canvas.setAttribute("aria-label", callbacks.canvasLabel);
    },
    setTheme: (nextTheme, nextNodeColors) => {
      if (nextTheme === theme && nextNodeColors === nodeColors) return;
      theme = nextTheme;
      nodeColors = nextNodeColors;
      graph.backgroundColor(theme.background);
      guides?.setColor(theme.accent);
      graph.refresh();
      if (animationPaused) renderStaticFrame();
    },
    suspend: () => {
      if (disposed) return;
      interactionActive = false;
      clearIdleTimers();
      pauseAnimation();
      resizeObserver?.unobserve(currentHost);
      const parkingHost = document.createElement("div");
      parkingHost.append(...currentHost.childNodes);
      currentHost = parkingHost;
      lastWidth = 0;
      lastHeight = 0;
    }
  };
}
