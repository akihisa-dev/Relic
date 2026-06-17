import {
  relicFreeDrawingShapeTypes,
  type RelicFreeDrawingShapeType
} from "../../../shared/diagramMarkdown";

export const diagramShapeDragType = "application/x-relic-diagram-shape";

export function isFreeDrawingShapeType(value: string): value is RelicFreeDrawingShapeType {
  return relicFreeDrawingShapeTypes.includes(value as RelicFreeDrawingShapeType);
}
