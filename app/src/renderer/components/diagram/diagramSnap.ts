import { type DiagramCanvasNodeLayout } from "./diagramGeometry";

export interface DiagramSnapGuide {
  axis: "x" | "y";
  value: number;
}

export interface DiagramSnapResult {
  guides: DiagramSnapGuide[];
  x: number;
  y: number;
}

const snapThreshold = 8;
export const diagramGridSize = 32;

export function snapDiagramNode(
  movingNodeId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  nodes: DiagramCanvasNodeLayout[]
): DiagramSnapResult {
  const guides: DiagramSnapGuide[] = [];
  const xSnap = nearestSnap(
    [
      { offset: 0, value: x },
      { offset: width / 2, value: x + width / 2 },
      { offset: width, value: x + width }
    ],
    nodes
      .filter((node) => node.node.id !== movingNodeId)
      .flatMap((node) => [
        node.node.x,
        node.node.x + node.node.width / 2,
        node.node.x + node.node.width
      ])
  );
  const ySnap = nearestSnap(
    [
      { offset: 0, value: y },
      { offset: height / 2, value: y + height / 2 },
      { offset: height, value: y + height }
    ],
    nodes
      .filter((node) => node.node.id !== movingNodeId)
      .flatMap((node) => [
        node.node.y,
        node.node.y + node.node.height / 2,
        node.node.y + node.node.height
      ])
  );

  if (xSnap) guides.push({ axis: "x", value: xSnap.target });
  if (ySnap) guides.push({ axis: "y", value: ySnap.target });

  return {
    guides,
    x: xSnap ? xSnap.target - xSnap.offset : x,
    y: ySnap ? ySnap.target - ySnap.offset : y
  };
}

export function snapDiagramPointToGrid(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(x / diagramGridSize) * diagramGridSize,
    y: Math.round(y / diagramGridSize) * diagramGridSize
  };
}

function nearestSnap(
  movingValues: Array<{ offset: number; value: number }>,
  targets: number[]
): { offset: number; target: number } | null {
  let best: { distance: number; offset: number; target: number } | null = null;

  for (const moving of movingValues) {
    for (const target of targets) {
      const distance = Math.abs(target - moving.value);
      if (distance > snapThreshold) continue;
      if (best && distance >= best.distance) continue;
      best = {
        distance,
        offset: moving.offset,
        target
      };
    }
  }

  if (!best) return null;

  return {
    offset: best.offset,
    target: best.target
  };
}
