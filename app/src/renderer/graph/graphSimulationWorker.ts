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
  applyGraphCategoryBoundary,
  graphCategoryAttractionStrength,
  graphCategoryLayouts,
  graphCategoryTarget
} from "./graphCategoryModel";
import {
  defaultGraphOptions,
  type GraphOptions,
  type GraphSimulationRequest,
  type GraphSimulationResponse
} from "./graphTypes";

interface WorkerNode extends SimulationNodeDatum {
  backlinkCount: number;
  category: string | null;
  id: string;
  linkCount: number;
}

interface WorkerLink extends SimulationLinkDatum<WorkerNode> {
  count: number;
  source: string | WorkerNode;
  target: string | WorkerNode;
}

type GraphSimulationWorkerScope = {
  onmessage: ((event: MessageEvent<GraphSimulationRequest>) => void) | null;
  postMessage: (message: GraphSimulationResponse, transfer?: Transferable[]) => void;
};

const ctx = self as unknown as GraphSimulationWorkerScope;

let currentOptions: GraphOptions = defaultGraphOptions;
let simulation: Simulation<WorkerNode, WorkerLink> | null = null;
let workerLinks: WorkerLink[] = [];
let workerNodes: WorkerNode[] = [];

ctx.onmessage = (event: MessageEvent<GraphSimulationRequest>) => {
  try {
    handleGraphSimulationRequest(event.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "グラフの物理演算に失敗しました。";
    postGraphSimulationMessage({ message, type: "error" });
  }
};

function handleGraphSimulationRequest(message: GraphSimulationRequest): void {
  if (message.type === "sync") {
    syncSimulation(message);
    return;
  }

  if (message.type === "options") {
    updateSimulationOptions(message.options, message.alpha);
    return;
  }

  if (message.type === "fixedNode") {
    updateFixedNode(message.id, message.x, message.y, message.alpha);
    return;
  }

  if (message.type === "restart") {
    restartSimulation(message.alpha);
    return;
  }

  disposeSimulation();
}

function syncSimulation(message: Extract<GraphSimulationRequest, { type: "sync" }>): void {
  currentOptions = message.options;
  workerNodes = message.nodes.map((node) => ({
    backlinkCount: node.backlinkCount,
    category: node.category,
    fx: node.fx,
    fy: node.fy,
    id: node.id,
    linkCount: node.linkCount,
    vx: node.vx,
    vy: node.vy,
    x: node.x,
    y: node.y
  }));
  workerLinks = message.links.map((link) => ({
    count: link.count,
    source: link.source,
    target: link.target
  }));

  simulation?.stop();
  simulation = forceSimulation<WorkerNode, WorkerLink>(workerNodes)
    .alphaDecay(1 - Math.pow(0.001, 1 / 300))
    .velocityDecay(0.4)
    .on("tick", postGraphPositions);

  updateSimulationForces();
  restartSimulation(message.alpha ?? 0.3);
}

function updateSimulationOptions(options: GraphOptions, alpha = 0.18): void {
  currentOptions = options;
  updateSimulationForces();
  restartSimulation(alpha);
}

function updateSimulationForces(): void {
  if (!simulation) return;
  const categoryLayouts = new Map(
    graphCategoryLayouts(workerNodes).map((layout) => [layout.category, layout])
  );

  simulation
    .force(
      "x",
      forceX<WorkerNode>((node) => graphCategoryTarget(node, categoryLayouts)?.x ?? 0)
        .strength((node) => node.category ? graphCategoryAttractionStrength : currentOptions.centerStrength)
    )
    .force(
      "y",
      forceY<WorkerNode>((node) => graphCategoryTarget(node, categoryLayouts)?.y ?? 0)
        .strength((node) => node.category ? graphCategoryAttractionStrength : currentOptions.centerStrength)
    )
    .force(
      "charge",
      forceManyBody<WorkerNode>()
        .strength(() => -Math.max(1, currentOptions.repelStrength * currentOptions.repelStrength * 2))
        .distanceMax(Math.max(300, currentOptions.linkDistance * 4))
    )
    .force(
      "link",
      forceLink<WorkerNode, WorkerLink>(workerLinks)
        .id((node) => node.id)
        .distance(currentOptions.linkDistance)
        .strength((link) => Math.min(1, currentOptions.linkStrength * Math.sqrt(Math.max(1, link.count))))
    )
    .force(
      "collide",
      forceCollide<WorkerNode>()
        .radius((node) => graphNodeBaseRadiusFromWeight(graphNodeWeight(node), currentOptions) + 6)
        .strength(0.34)
    )
    .force(
      "category-boundary",
      (alpha) => applyGraphCategoryBoundary(workerNodes, categoryLayouts, alpha)
    );
}

function updateFixedNode(id: string, x: number | null, y: number | null, alpha = 0.3): void {
  const node = workerNodes.find((candidate) => candidate.id === id);
  if (!node || !simulation) return;

  node.fx = x;
  node.fy = y;
  if (x !== null) node.x = x;
  if (y !== null) node.y = y;

  if (x === null && y === null) {
    simulation.alphaTarget(0);
    restartSimulation(0.08);
    return;
  }

  simulation.alphaTarget(alpha);
  restartSimulation(alpha);
}

function restartSimulation(alpha = 0.3): void {
  if (!simulation) {
    postGraphPositions();
    return;
  }

  simulation.alpha(Math.max(simulation.alpha(), alpha)).restart();
  postGraphPositions();
}

function disposeSimulation(): void {
  simulation?.stop();
  simulation = null;
  workerLinks = [];
  workerNodes = [];
}

function postGraphPositions(): void {
  const buffer = new ArrayBuffer(workerNodes.length * 4 * Float32Array.BYTES_PER_ELEMENT);
  const values = new Float32Array(buffer);
  const ids: string[] = [];

  workerNodes.forEach((node, index) => {
    const offset = index * 4;
    ids.push(node.id);
    values[offset] = node.x ?? 0;
    values[offset + 1] = node.y ?? 0;
    values[offset + 2] = node.vx ?? 0;
    values[offset + 3] = node.vy ?? 0;
  });

  postGraphSimulationMessage({ buffer, ids, type: "positions" }, [buffer]);
}

function postGraphSimulationMessage(message: GraphSimulationResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(message, transfer);
}
