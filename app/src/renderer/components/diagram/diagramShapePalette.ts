import { type RelicFreeDrawingShapeType } from "../../../shared/diagramMarkdown";
import { type Translator } from "../../i18nModel";

export interface DiagramShapePaletteItem {
  group: "flow" | "structure";
  label: string;
  shape: RelicFreeDrawingShapeType;
}

const flowShapes: RelicFreeDrawingShapeType[] = ["terminator", "process", "decision", "input-output"];
const structureShapes: RelicFreeDrawingShapeType[] = ["area"];

export function diagramShapePaletteItems(t: Translator): DiagramShapePaletteItem[] {
  return [
    ...flowShapes.map((shape) => ({
      group: "flow" as const,
      label: t(`diagram.freeDrawingShape.${shape}`),
      shape
    })),
    ...structureShapes.map((shape) => ({
      group: "structure" as const,
      label: t(`diagram.freeDrawingShape.${shape}`),
      shape
    }))
  ];
}

export function diagramShapePaletteGroups(t: Translator): Array<{
  items: DiagramShapePaletteItem[];
  title: string;
}> {
  const items = diagramShapePaletteItems(t);

  return [
    {
      items: items.filter((item) => item.group === "flow"),
      title: t("diagram.shapeGroup.flow")
    },
    {
      items: items.filter((item) => item.group === "structure"),
      title: t("diagram.shapeGroup.structure")
    }
  ];
}
