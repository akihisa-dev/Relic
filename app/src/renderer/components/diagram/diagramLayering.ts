import {
  relicFreeDrawingAreaLayer,
  relicFreeDrawingLabelLayer,
  relicFreeDrawingShapeLayer,
  type RelicConnectedDiagramNode
} from "../../../shared/diagramMarkdown";

export const diagramLayerBase = 100;
const diagramNodeActiveLayerBoost = 1000;

export function diagramNodeDisplayLayer(
  node: RelicConnectedDiagramNode,
  isDragging: boolean,
  isSelected: boolean
): number {
  const displayLayer = diagramLayerBase + nodeDisplayLayer(node);
  if ("layer" in node) return displayLayer;
  if (isDragging || isSelected) return displayLayer + diagramNodeActiveLayerBoost;

  return displayLayer;
}

export function diagramFreeDrawingLabelDisplayLayer(): number {
  return diagramLayerBase + relicFreeDrawingLabelLayer;
}

export function diagramLineDisplayLayer(from: RelicConnectedDiagramNode, to: RelicConnectedDiagramNode): number {
  return diagramLayerBase + Math.max(nodeDisplayLayer(from), nodeDisplayLayer(to));
}

function nodeDisplayLayer(node: RelicConnectedDiagramNode): number {
  if (!("layer" in node)) return 0;

  return node.shape === "area" ? relicFreeDrawingAreaLayer : relicFreeDrawingShapeLayer;
}
