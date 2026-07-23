import ForceGraph3D, { type ForceGraph3DInstance } from "3d-force-graph";
import { Quaternion, Vector3 } from "three";

import { defaultGraphDrawTheme, type GraphDrawTheme } from "../graph/graphThemeModel";
import {
  createSphereGuides,
  type SphereGuides
} from "./sphereGuides";
import {
  SPHERE_MIN_GUIDE_RADIUS,
  sphereCameraFitDistance,
  sphereColorWithOpacity,
  sphereCoreRadius,
  sphereFocusIds,
  sphereLayoutSettings,
  sphereLinkDistance,
  sphereLinkTouchesFocus,
  sphereNodeChargeStrength,
  sphereQuarterCameraPosition,
  sphereStarColor,
  type SphereData,
  type SphereLink,
  type SphereNode
} from "./sphereModel";

interface SphereRuntimeCallbacks {
  canvasLabel: string;
  onBackgroundClick: () => void;
  onContextLost: () => void;
  onNodeClick: (node: SphereNode) => void;
  onNodeHover: (node: SphereNode | null) => void;
}

export interface SphereRuntime {
  attach: (host: HTMLElement) => void;
  dispose: () => void;
  resetView: () => void;
  setData: (data: SphereData) => void;
  setCallbacks: (callbacks: SphereRuntimeCallbacks) => void;
  setFocus: (focusId: string | null) => void;
  setTheme: (theme: GraphDrawTheme, nodeColors: ReadonlyMap<string, string>) => void;
  suspend: () => void;
}

type OrbitControlLimits = {
  addEventListener?: (type: "end" | "start", listener: () => void) => void;
  cursor?: { set: (x: number, y: number, z: number) => void };
  enablePan?: boolean;
  enableRotate?: boolean;
  maxDistance?: number;
  maxTargetRadius?: number;
  maxPolarAngle?: number;
  minDistance?: number;
  minPolarAngle?: number;
  removeEventListener?: (type: "end" | "start", listener: () => void) => void;
  target?: Vector3;
  update?: () => void;
};

type SphereCamera = {
  aspect: number;
  fov: number;
  lookAt: (target: Vector3) => void;
  position: Vector3;
  up: Vector3;
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

const SPHERE_ORBIT_DRAG_THRESHOLD_PX = 5;

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
  let animationPaused = false;

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
  const pauseAnimation = () => {
    if (animationPaused) return;
    graph.pauseAnimation();
    animationPaused = true;
  };
  const resumeAnimation = () => {
    if (!animationPaused) return;
    graph.resumeAnimation();
    animationPaused = false;
  };
  const renderStaticFrame = () => {
    if (disposed || document.hidden) return;
    renderer.render(scene, graph.camera());
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
    controls.maxTargetRadius = guideRadius;
  };
  const fitQuarterView = (duration: number) => {
    const bounds = graph.getGraphBbox();
    const rect = currentHost.getBoundingClientRect();
    const fitDistance = bounds
      ? sphereCameraFitDistance(bounds, {
        aspect: camera.aspect,
        fov: camera.fov,
        height: Math.max(1, Math.floor(rect.height))
      }, 72)
      : null;
    const distance = Math.min(
      controls.maxDistance ?? 4_800,
      Math.max(controls.minDistance ?? 48, fitDistance ?? guideRadius * 3)
    );
    controls.cursor?.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    resumeAnimation();
    graph.cameraPosition(
      sphereQuarterCameraPosition(distance),
      { x: 0, y: 0, z: 0 },
      duration
    );
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
    .linkVisibility(true)
    .linkOpacity(0.42)
    .linkWidth((link) => {
      return sphereLinkTouchesFocus(link, focusId) ? 2.4 : 0;
    })
    .nodeColor((node) => {
      const baseColor = nodeColors.get(node.id) ?? theme.textSecondary;
      if (!focusId) return sphereStarColor(baseColor, node);
      if (node.id === focusId) return theme.accent;
      return focusIds.has(node.id) ? baseColor : sphereColorWithOpacity(theme.border, 0.16);
    })
    .linkColor((link) => focusId && sphereLinkTouchesFocus(link, focusId)
      ? theme.accent
      : focusId
        ? sphereColorWithOpacity(theme.textSecondary, 0.12)
        : theme.textSecondary)
    .onNodeHover((node) => callbacks.onNodeHover(node))
    .onNodeClick((node) => callbacks.onNodeClick(node))
    .onBackgroundClick(() => callbacks.onBackgroundClick())
    .onEngineTick(() => {
      if (!layoutPending || !guides) return;
      followLayoutRadius();
    })
    .onEngineStop(() => {
      if (!layoutPending || data.nodes.length === 0) return;
      layoutPending = false;
      const shouldFit = fitPending;
      fitPending = false;
      followLayoutRadius();
      if (shouldFit) {
        hasFittedData = true;
        fitQuarterView(420);
      }
    });

  const controls = graph.controls() as OrbitControlLimits;
  controls.enablePan = true;
  controls.enableRotate = false;
  controls.minDistance = 48;
  controls.maxDistance = 4_800;
  controls.maxTargetRadius = SPHERE_MIN_GUIDE_RADIUS;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  const handleControlsStart = () => guides?.setInteractionActive(true);
  const handleControlsEnd = () => guides?.setInteractionActive(false);
  controls.addEventListener?.("start", handleControlsStart);
  controls.addEventListener?.("end", handleControlsEnd);
  const renderer = graph.renderer();
  const camera = graph.camera() as unknown as SphereCamera;
  const canvas = renderer.domElement;
  const sphereUp = new Vector3(0, 1, 0);
  const orbitRotation = new Quaternion();
  const orbitPitchAxis = new Vector3();
  const orbitViewDirection = new Vector3();
  const orbitProposedPosition = new Vector3();
  const rotateAroundSphere = (deltaX: number, deltaY: number) => {
    const target = controls.target;
    if (!target) return;
    const height = Math.max(1, currentHost.getBoundingClientRect().height);
    const radiansPerPixel = (Math.PI * 2) / height;
    orbitRotation.setFromAxisAngle(sphereUp, -deltaX * radiansPerPixel);
    camera.position.applyQuaternion(orbitRotation);
    target.applyQuaternion(orbitRotation);
    camera.up.applyQuaternion(orbitRotation);

    orbitViewDirection.subVectors(target, camera.position).normalize();
    orbitPitchAxis.crossVectors(orbitViewDirection, camera.up).normalize();
    if (orbitPitchAxis.lengthSq() > 0 && deltaY !== 0) {
      orbitRotation.setFromAxisAngle(orbitPitchAxis, -deltaY * radiansPerPixel);
      orbitProposedPosition.copy(camera.position).applyQuaternion(orbitRotation);
      const radius = orbitProposedPosition.length();
      const polarAngle = radius === 0
        ? Math.PI / 2
        : Math.acos(Math.max(-1, Math.min(1, orbitProposedPosition.y / radius)));
      if (polarAngle >= (controls.minPolarAngle ?? 0) && polarAngle <= (controls.maxPolarAngle ?? Math.PI)) {
        camera.position.copy(orbitProposedPosition);
        target.applyQuaternion(orbitRotation);
        camera.up.applyQuaternion(orbitRotation);
      }
    }
    camera.lookAt(target);
    controls.update?.();
  };
  let orbitPointer: {
    active: boolean;
    id: number;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
  } | null = null;
  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      orbitPointer = null;
      return;
    }
    orbitPointer = {
      active: false,
      id: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY
    };
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (!orbitPointer || event.pointerId !== orbitPointer.id) return;
    if (!orbitPointer.active) {
      if (Math.hypot(event.clientX - orbitPointer.startX, event.clientY - orbitPointer.startY) <= SPHERE_ORBIT_DRAG_THRESHOLD_PX) return;
      orbitPointer.active = true;
      guides?.setInteractionActive(true);
    }
    rotateAroundSphere(event.clientX - orbitPointer.lastX, event.clientY - orbitPointer.lastY);
    orbitPointer.lastX = event.clientX;
    orbitPointer.lastY = event.clientY;
  };
  const handlePointerEnd = () => {
    if (orbitPointer?.active) guides?.setInteractionActive(false);
    orbitPointer = null;
  };
  canvas.addEventListener("pointerdown", handlePointerDown);
  document.addEventListener("pointermove", handlePointerMove, true);
  document.addEventListener("pointerup", handlePointerEnd, true);
  canvas.addEventListener("pointercancel", handlePointerEnd);
  canvas.addEventListener("lostpointercapture", handlePointerEnd);
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
      pauseAnimation();
    } else {
      resumeAnimation();
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
      resumeAnimation();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      controls.removeEventListener?.("start", handleControlsStart);
      controls.removeEventListener?.("end", handleControlsEnd);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerEnd, true);
      canvas.removeEventListener("pointercancel", handlePointerEnd);
      canvas.removeEventListener("lostpointercapture", handlePointerEnd);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      resizeObserver?.unobserve(currentHost);
      resizeObserver?.disconnect();
      cancelNodeDataFrame();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      clearGuides();
      pauseAnimation();
      graph
        .nodeLabel("")
        .nodeVal(1)
        .nodeColor(theme.textSecondary)
        .linkColor(theme.border)
        .linkWidth(0)
        .onNodeHover(() => undefined)
        .onNodeClick(() => undefined)
        .onBackgroundClick(() => undefined)
        .onEngineTick(() => undefined)
        .onEngineStop(() => undefined);
      graph.d3Force("sphere-boundary", null);
      graph.d3Force("link", null);
      graph.d3Force("charge", null);
      renderer.forceContextLoss();
      graph._destructor();
      currentHost.replaceChildren();
    },
    resetView: () => {
      if (disposed || data.nodes.length === 0 || !hasRenderedData) return;
      fitQuarterView(420);
    },
    setData: (nextData) => {
      if (nextData === data) return;
      resumeAnimation();
      const shouldClearRenderedData = hasRenderedData;
      data = nextData;
      controls.maxTargetRadius = SPHERE_MIN_GUIDE_RADIUS;
      layoutPending = false;
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
