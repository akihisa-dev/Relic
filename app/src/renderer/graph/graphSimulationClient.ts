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
  graphNodeBaseRadiusFromWeight,
  graphNodeWeight
} from "./graphLayout";
import {
  defaultGraphOptions,
  type GraphOptions,
  type GraphSimulationLinkSnapshot,
  type GraphSimulationNodeSnapshot,
  type GraphSimulationPositionsMessage,
  type GraphSimulationRequest,
  type GraphSimulationResponse
} from "./graphTypes";

export interface GraphSimulationClient {
  dispose: () => void;
  restart: (alpha?: number) => void;
  setNodeFixed: (id: string, x: number | null, y: number | null, alpha?: number) => void;
  sync: (
    nodes: GraphSimulationNodeSnapshot[],
    links: GraphSimulationLinkSnapshot[],
    options: GraphOptions,
    alpha?: number
  ) => void;
  updateOptions: (options: GraphOptions, alpha?: number) => void;
}

type GraphSimulationPositionHandler = (message: GraphSimulationPositionsMessage) => void;
type GraphSimulationErrorHandler = (message: string) => void;

interface FallbackNode extends SimulationNodeDatum {
  backlinkCount: number;
  id: string;
  linkCount: number;
}

interface FallbackLink extends SimulationLinkDatum<FallbackNode> {
  count: number;
  source: string | FallbackNode;
  target: string | FallbackNode;
}

export function createGraphSimulationClient(
  onPositions: GraphSimulationPositionHandler,
  onError: GraphSimulationErrorHandler = () => undefined
): GraphSimulationClient {
  if (typeof Worker === "function") {
    try {
      return createWorkerGraphSimulationClient(onPositions, onError);
    } catch (error) {
      onError(error instanceof Error ? error.message : "グラフのWorkerを起動できませんでした。");
    }
  }

  return createFallbackGraphSimulationClient(onPositions);
}

function createWorkerGraphSimulationClient(
  onPositions: GraphSimulationPositionHandler,
  onError: GraphSimulationErrorHandler
): GraphSimulationClient {
  const worker = new Worker(new URL("./graphSimulationWorker.ts", import.meta.url), {
    name: "Relic Graph Simulation",
    type: "module"
  });
  let disposed = false;

  worker.onmessage = (event: MessageEvent<GraphSimulationResponse>) => {
    if (disposed) return;

    const message = event.data;
    if (message.type === "positions") {
      onPositions(message);
      return;
    }

    onError(message.message);
  };
  worker.onerror = (event) => {
    if (!disposed) onError(event.message || "グラフのWorkerでエラーが発生しました。");
  };

  const post = (message: GraphSimulationRequest) => {
    if (!disposed) worker.postMessage(message);
  };

  return {
    dispose: () => {
      disposed = true;
      worker.postMessage({ type: "dispose" } satisfies GraphSimulationRequest);
      worker.terminate();
    },
    restart: (alpha) => post({ alpha, type: "restart" }),
    setNodeFixed: (id, x, y, alpha) => post({ alpha, id, type: "fixedNode", x, y }),
    sync: (nodes, links, options, alpha) => post({ alpha, links, nodes, options, type: "sync" }),
    updateOptions: (options, alpha) => post({ alpha, options, type: "options" })
  };
}

function createFallbackGraphSimulationClient(onPositions: GraphSimulationPositionHandler): GraphSimulationClient {
  let currentOptions: GraphOptions = defaultGraphOptions;
  let disposed = false;
  let fallbackLinks: FallbackLink[] = [];
  let fallbackNodes: FallbackNode[] = [];
  let simulation: Simulation<FallbackNode, FallbackLink> | null = null;

  const postPositions = () => {
    if (disposed) return;

    const buffer = new ArrayBuffer(fallbackNodes.length * 4 * Float32Array.BYTES_PER_ELEMENT);
    const values = new Float32Array(buffer);
    const ids: string[] = [];

    fallbackNodes.forEach((node, index) => {
      const offset = index * 4;
      ids.push(node.id);
      values[offset] = node.x ?? 0;
      values[offset + 1] = node.y ?? 0;
      values[offset + 2] = node.vx ?? 0;
      values[offset + 3] = node.vy ?? 0;
    });

    onPositions({ buffer, ids, type: "positions" });
  };

  const updateForces = () => {
    if (!simulation) return;

    simulation
      .force("x", forceX<FallbackNode>(0).strength(currentOptions.centerStrength))
      .force("y", forceY<FallbackNode>(0).strength(currentOptions.centerStrength))
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
          .strength((link) => Math.min(1, currentOptions.linkStrength * Math.sqrt(Math.max(1, link.count))))
      )
      .force(
        "collide",
        forceCollide<FallbackNode>()
          .radius((node) => graphNodeBaseRadiusFromWeight(graphNodeWeight(node), currentOptions) + 6)
          .strength(0.34)
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
    setNodeFixed: (id, x, y, alpha = 0.3) => {
      const node = fallbackNodes.find((candidate) => candidate.id === id);
      if (!node || !simulation) return;

      node.fx = x;
      node.fy = y;
      if (x !== null) node.x = x;
      if (y !== null) node.y = y;

      if (x === null && y === null) {
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
        .velocityDecay(0.4)
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
