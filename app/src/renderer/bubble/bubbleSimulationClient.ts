import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum
} from "d3-force";

import {
  bubbleNodeBaseRadiusFromWeight,
  bubbleNodeWeight
} from "./bubbleLayout";
import {
  applyBubbleCategoryMotion,
  bubbleCategoryDriftCenterStrength
} from "./bubbleCategoryModel";
import { bubbleLinkAttractionStrength } from "./bubblePhysicsModel";
import {
  defaultBubbleOptions,
  bubbleSimulationVelocityDecay,
  type BubbleOptions,
  type BubbleSimulationLinkSnapshot,
  type BubbleSimulationNodeSnapshot,
  type BubbleSimulationPositionsMessage,
  type BubbleSimulationRequest,
  type BubbleSimulationResponse
} from "./bubbleTypes";

export interface BubbleSimulationClient {
  dispose: () => void;
  restart: (alpha?: number) => void;
  setNodeCategoryCenterOffset: (id: string, offsetX: number, offsetY: number) => void;
  setNodeFixed: (
    id: string,
    x: number | null,
    y: number | null,
    alpha?: number,
    velocityX?: number,
    velocityY?: number
  ) => void;
  sync: (
    nodes: BubbleSimulationNodeSnapshot[],
    links: BubbleSimulationLinkSnapshot[],
    options: BubbleOptions,
    alpha?: number
  ) => void;
  updateOptions: (options: BubbleOptions, alpha?: number) => void;
}

type BubbleSimulationPositionHandler = (message: BubbleSimulationPositionsMessage) => void;
type BubbleSimulationErrorHandler = (message: string) => void;

interface FallbackNode extends SimulationNodeDatum {
  backlinkCount: number;
  category: string | null;
  categoryCenterOffsetX: number;
  categoryCenterOffsetY: number;
  id: string;
  linkCount: number;
}

interface FallbackLink extends SimulationLinkDatum<FallbackNode> {
  count: number;
  source: string | FallbackNode;
  target: string | FallbackNode;
}

export function createBubbleSimulationClient(
  onPositions: BubbleSimulationPositionHandler,
  onError: BubbleSimulationErrorHandler = () => undefined
): BubbleSimulationClient {
  if (typeof Worker === "function") {
    try {
      return createWorkerBubbleSimulationClient(onPositions, onError);
    } catch (error) {
      onError(error instanceof Error ? error.message : "バブルのWorkerを起動できませんでした。");
    }
  }

  return createFallbackBubbleSimulationClient(onPositions);
}

function createWorkerBubbleSimulationClient(
  onPositions: BubbleSimulationPositionHandler,
  onError: BubbleSimulationErrorHandler
): BubbleSimulationClient {
  const worker = new Worker(new URL("./bubbleSimulationWorker.ts", import.meta.url), {
    name: "Relic Bubble Simulation",
    type: "module"
  });
  let disposed = false;

  worker.onmessage = (event: MessageEvent<BubbleSimulationResponse>) => {
    if (disposed) return;

    const message = event.data;
    if (message.type === "positions") {
      onPositions(message);
      return;
    }

    onError(message.message);
  };
  worker.onerror = (event) => {
    if (!disposed) onError(event.message || "バブルのWorkerでエラーが発生しました。");
  };

  const post = (message: BubbleSimulationRequest) => {
    if (!disposed) worker.postMessage(message);
  };

  return {
    dispose: () => {
      if (disposed) return;

      disposed = true;
      try {
        worker.postMessage({ type: "dispose" } satisfies BubbleSimulationRequest);
      } finally {
        worker.terminate();
      }
    },
    restart: (alpha) => post({ alpha, type: "restart" }),
    setNodeCategoryCenterOffset: (id, offsetX, offsetY) => {
      post({ id, offsetX, offsetY, type: "categoryCenterOffset" });
    },
    setNodeFixed: (id, x, y, alpha, velocityX, velocityY) => {
      post({ alpha, id, type: "fixedNode", velocityX, velocityY, x, y });
    },
    sync: (nodes, links, options, alpha) => post({ alpha, links, nodes, options, type: "sync" }),
    updateOptions: (options, alpha) => post({ alpha, options, type: "options" })
  };
}

function createFallbackBubbleSimulationClient(onPositions: BubbleSimulationPositionHandler): BubbleSimulationClient {
  let currentOptions: BubbleOptions = defaultBubbleOptions;
  let disposed = false;
  let fallbackLinks: FallbackLink[] = [];
  let fallbackNodes: FallbackNode[] = [];
  let simulation: Simulation<FallbackNode, FallbackLink> | null = null;

  const postPositions = () => {
    if (disposed) return;

    const buffer = new ArrayBuffer(fallbackNodes.length * 6 * Float32Array.BYTES_PER_ELEMENT);
    const values = new Float32Array(buffer);
    const ids: string[] = [];

    fallbackNodes.forEach((node, index) => {
      const offset = index * 6;
      ids.push(node.id);
      values[offset] = node.x ?? 0;
      values[offset + 1] = node.y ?? 0;
      values[offset + 2] = node.vx ?? 0;
      values[offset + 3] = node.vy ?? 0;
      values[offset + 4] = node.categoryCenterOffsetX;
      values[offset + 5] = node.categoryCenterOffsetY;
    });

    onPositions({ buffer, ids, type: "positions" });
  };

  const updateForces = () => {
    if (!simulation) return;
    simulation
      .force(
        "x",
        forceX<FallbackNode>(0)
          .strength((node) => node.category ? bubbleCategoryDriftCenterStrength : currentOptions.centerStrength)
      )
      .force(
        "y",
        forceY<FallbackNode>(0)
          .strength((node) => node.category ? bubbleCategoryDriftCenterStrength : currentOptions.centerStrength)
      )
      .force(
        "charge",
        forceManyBody<FallbackNode>()
          .strength(() => -Math.max(1, currentOptions.repelStrength * currentOptions.repelStrength * 2))
          .distanceMax(Math.max(300, currentOptions.linkDistance * 4))
      )
      .force(
        "link",
        forceLink<FallbackNode, FallbackLink>(fallbackLinks)
          .id((node) => node.id)
          .distance(currentOptions.linkDistance)
          .strength((link) => bubbleLinkAttractionStrength(currentOptions.linkStrength, link.count))
      )
      .force(
        "collide",
        forceCollide<FallbackNode>()
          .radius((node) => bubbleNodeBaseRadiusFromWeight(bubbleNodeWeight(node), currentOptions) + 6)
          .strength(0.34)
      )
      .force(
        "category-boundary",
        (alpha) => {
          applyBubbleCategoryMotion(fallbackNodes, alpha);
        }
      );
  };

  const restart = (alpha = 0.3) => {
    if (!simulation) {
      postPositions();
      return;
    }

    simulation.alpha(Math.max(simulation.alpha(), alpha)).restart();
    postPositions();
  };

  return {
    dispose: () => {
      disposed = true;
      simulation?.stop();
      simulation = null;
      fallbackLinks = [];
      fallbackNodes = [];
    },
    restart,
    setNodeCategoryCenterOffset: (id, offsetX, offsetY) => {
      const node = fallbackNodes.find((candidate) => candidate.id === id);
      if (!node) return;
      node.categoryCenterOffsetX = offsetX;
      node.categoryCenterOffsetY = offsetY;
    },
    setNodeFixed: (id, x, y, alpha = 0.3, velocityX, velocityY) => {
      const node = fallbackNodes.find((candidate) => candidate.id === id);
      if (!node || !simulation) return;

      node.fx = x;
      node.fy = y;
      if (node.fx !== null) node.x = node.fx;
      if (node.fy !== null) node.y = node.fy;

      if (x === null && y === null) {
        node.vx = velocityX ?? node.vx;
        node.vy = velocityY ?? node.vy;
        simulation.alphaTarget(0);
        restart(0.08);
        return;
      }

      simulation.alphaTarget(alpha);
      restart(alpha);
    },
    sync: (nodes, links, options, alpha = 0.3) => {
      currentOptions = options;
      fallbackNodes = nodes.map((node) => ({
        backlinkCount: node.backlinkCount,
        category: node.category,
        categoryCenterOffsetX: node.categoryCenterOffsetX,
        categoryCenterOffsetY: node.categoryCenterOffsetY,
        fx: node.fx,
        fy: node.fy,
        id: node.id,
        linkCount: node.linkCount,
        vx: node.vx,
        vy: node.vy,
        x: node.x,
        y: node.y
      }));
      fallbackLinks = links.map((link) => ({
        count: link.count,
        source: link.source,
        target: link.target
      }));

      simulation?.stop();
      simulation = forceSimulation<FallbackNode, FallbackLink>(fallbackNodes)
        .alphaDecay(1 - Math.pow(0.001, 1 / 300))
        .velocityDecay(bubbleSimulationVelocityDecay)
        .on("tick", postPositions);
      updateForces();
      restart(alpha);
    },
    updateOptions: (options, alpha = 0.18) => {
      currentOptions = options;
      updateForces();
      restart(alpha);
    }
  };
}
