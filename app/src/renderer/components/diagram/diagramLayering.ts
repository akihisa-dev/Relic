import {
  relicFreeDrawingAreaLayer,
  relicFreeDrawingLabelLayer,
  relicFreeDrawingShapeLayer,
  type RelicConnectedDiagramNode
} from "../../../shared/diagramMarkdown";

export const diagramLayerBase = 100;

export function diagramNodeDisplayLayer(
  node: RelicConnectedDiagramNode,
  _isDragging: boolean,
  _isSelected: boolean
): number {
  return diagramLayerBase + nodeDisplayLayer(node);
}

export function diagramFreeDrawingLabelDisplayLayer(): number {
  return diagramLayerBase + relicFreeDrawingLabelLayer;
}

export function diagramLineDisplayLayer(from: RelicConnectedDiagramNode, to: RelicConnectedDiagramNode): number {
  return diagramLayerBase + Math.max(nodeDisplayLayer(from), nodeDisplayLayer(to));
}

function nodeDisplayLayer(node: RelicConnectedDiagramNode): number {
  return node.shape === "area" ? relicFreeDrawingAreaLayer : relicFreeDrawingShapeLayer;
}
