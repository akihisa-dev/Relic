import { parseRelicDiagramMarkdown, type RelicConnectedDiagramDocument } from "../../../shared/diagramMarkdown";
import type { useT } from "../../i18n";

export function diagramCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return t("diagram.invalidStatus");

  const diagram = parsed.value as RelicConnectedDiagramDocument;

  return t("diagram.status", {
    ...diagramStatusCountLabels(diagram.nodes.length, diagram.lines.length, t)
  });
}

export function diagramStatusCountLabels(
  nodes: number,
  lines: number,
  t: ReturnType<typeof useT>
): { lineCount: string; nodeCount: string } {
  return {
    lineCount: lines === 1
      ? t("diagram.countOneLine", { count: lines })
      : t("diagram.countLines", { count: lines }),
    nodeCount: nodes === 1
      ? t("diagram.countOneShape", { count: nodes })
      : t("diagram.countShapes", { count: nodes })
  };
}
