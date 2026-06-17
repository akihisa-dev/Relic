import { type RelicConnectedDiagramNode } from "../../../shared/diagramMarkdown";

export const diagramLayerBase = 100;
const diagramNodeActiveLayerBoost = 1000;

export function diagramNodeDisplayLayer(
  node: RelicConnectedDiagramNode,
  isDragging: boolean,
  isSelected: boolean
): number {
  const layer = "layer" in node ? node.layer : 0;
  const displayLayer = diagramLayerBase + layer;
  if ("layer" in node) return displayLayer;
  if (isDragging || isSelected) return displayLayer + diagramNodeActiveLayerBoost;

  return displayLayer;
}

export function diagramLineDisplayLayer(from: RelicConnectedDiagramNode, to: RelicConnectedDiagramNode): number {
  return diagramLayerBase + Math.max(nodeLayer(from), nodeLayer(to));
}

function nodeLayer(node: RelicConnectedDiagramNode): number {
  return "layer" in node ? node.layer : 0;
}
