import {
  relicFreeDrawingShapeTypes,
  type RelicFreeDrawingShapeType
} from "../../../shared/diagramMarkdown";

export const freeDrawingShapeDragType = "application/x-relic-free-drawing-shape";

export function isFreeDrawingShapeType(value: string): value is RelicFreeDrawingShapeType {
  return relicFreeDrawingShapeTypes.includes(value as RelicFreeDrawingShapeType);
}
