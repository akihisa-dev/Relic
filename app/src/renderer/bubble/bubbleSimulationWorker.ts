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
  type BubbleSimulationRequest,
  type BubbleSimulationResponse
} from "./bubbleTypes";

interface WorkerNode extends SimulationNodeDatum {
  backlinkCount: number;
  category: string | null;
  categoryCenterOffsetX: number;
  categoryCenterOffsetY: number;
  id: string;
  linkCount: number;
}

interface WorkerLink extends SimulationLinkDatum<WorkerNode> {
  count: number;
  source: string | WorkerNode;
  target: string | WorkerNode;
}

type BubbleSimulationWorkerScope = {
  onmessage: ((event: MessageEvent<BubbleSimulationRequest>) => void) | null;
  postMessage: (message: BubbleSimulationResponse, transfer?: Transferable[]) => void;
};

const ctx = self as unknown as BubbleSimulationWorkerScope;

let currentOptions: BubbleOptions = defaultBubbleOptions;
let simulation: Simulation<WorkerNode, WorkerLink> | null = null;
let workerLinks: WorkerLink[] = [];
let workerNodes: WorkerNode[] = [];

ctx.onmessage = (event: MessageEvent<BubbleSimulationRequest>) => {
  try {
    handleBubbleSimulationRequest(event.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "バブルの物理演算に失敗しました。";
    postBubbleSimulationMessage({ message, type: "error" });
  }
};

function handleBubbleSimulationRequest(message: BubbleSimulationRequest): void {
  if (message.type === "sync") {
    syncSimulation(message);
    return;
  }

  if (message.type === "options") {
    updateSimulationOptions(message.options, message.alpha);
    return;
  }

  if (message.type === "fixedNode") {
    updateFixedNode(
      message.id,
      message.x,
      message.y,
      message.alpha,
      message.velocityX,
      message.velocityY
    );
    return;
  }

  if (message.type === "categoryCenterOffset") {
    updateCategoryCenterOffset(message.id, message.offsetX, message.offsetY);
    return;
  }

  if (message.type === "restart") {
    restartSimulation(message.alpha);
    return;
  }

  disposeSimulation();
}

function syncSimulation(message: Extract<BubbleSimulationRequest, { type: "sync" }>): void {
  currentOptions = message.options;
  workerNodes = message.nodes.map((node) => ({
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
  workerLinks = message.links.map((link) => ({
    count: link.count,
    source: link.source,
    target: link.target
  }));

  simulation?.stop();
  simulation = forceSimulation<WorkerNode, WorkerLink>(workerNodes)
    .alphaDecay(1 - Math.pow(0.001, 1 / 300))
    .velocityDecay(bubbleSimulationVelocityDecay)
    .on("tick", postBubblePositions);

  updateSimulationForces();
  restartSimulation(message.alpha ?? 0.3);
}

function updateCategoryCenterOffset(id: string, offsetX: number, offsetY: number): void {
  const node = workerNodes.find((candidate) => candidate.id === id);
  if (!node) return;
  node.categoryCenterOffsetX = offsetX;
  node.categoryCenterOffsetY = offsetY;
}

function updateSimulationOptions(options: BubbleOptions, alpha = 0.18): void {
  currentOptions = options;
  updateSimulationForces();
  restartSimulation(alpha);
}

function updateSimulationForces(): void {
  if (!simulation) return;
  simulation
    .force(
      "x",
      forceX<WorkerNode>(0)
        .strength((node) => node.category ? bubbleCategoryDriftCenterStrength : currentOptions.centerStrength)
    )
    .force(
      "y",
      forceY<WorkerNode>(0)
        .strength((node) => node.category ? bubbleCategoryDriftCenterStrength : currentOptions.centerStrength)
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
        .strength((link) => bubbleLinkAttractionStrength(currentOptions.linkStrength, link.count))
    )
    .force(
      "collide",
      forceCollide<WorkerNode>()
        .radius((node) => bubbleNodeBaseRadiusFromWeight(bubbleNodeWeight(node), currentOptions) + 6)
        .strength(0.34)
    )
    .force(
      "category-boundary",
      (alpha) => {
        applyBubbleCategoryMotion(workerNodes, alpha);
      }
    );
}

function updateFixedNode(
  id: string,
  x: number | null,
  y: number | null,
  alpha = 0.3,
  velocityX?: number,
  velocityY?: number
): void {
  const node = workerNodes.find((candidate) => candidate.id === id);
  if (!node || !simulation) return;

  node.fx = x;
  node.fy = y;
  if (node.fx !== null) node.x = node.fx;
  if (node.fy !== null) node.y = node.fy;

  if (x === null && y === null) {
    node.vx = velocityX ?? node.vx;
    node.vy = velocityY ?? node.vy;
    simulation.alphaTarget(0);
    restartSimulation(0.08);
    return;
  }

  simulation.alphaTarget(alpha);
  restartSimulation(alpha);
}

function restartSimulation(alpha = 0.3): void {
  if (!simulation) {
    postBubblePositions();
    return;
  }

  simulation.alpha(Math.max(simulation.alpha(), alpha)).restart();
  postBubblePositions();
}

function disposeSimulation(): void {
  simulation?.stop();
  simulation = null;
  workerLinks = [];
  workerNodes = [];
}

function postBubblePositions(): void {
  const buffer = new ArrayBuffer(workerNodes.length * 6 * Float32Array.BYTES_PER_ELEMENT);
  const values = new Float32Array(buffer);
  const ids: string[] = [];

  workerNodes.forEach((node, index) => {
    const offset = index * 6;
    ids.push(node.id);
    values[offset] = node.x ?? 0;
    values[offset + 1] = node.y ?? 0;
    values[offset + 2] = node.vx ?? 0;
    values[offset + 3] = node.vy ?? 0;
    values[offset + 4] = node.categoryCenterOffsetX;
    values[offset + 5] = node.categoryCenterOffsetY;
  });

  postBubbleSimulationMessage({ buffer, ids, type: "positions" }, [buffer]);
}

function postBubbleSimulationMessage(message: BubbleSimulationResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(message, transfer);
}
