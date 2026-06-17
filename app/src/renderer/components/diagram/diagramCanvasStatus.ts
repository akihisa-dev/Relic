import { parseRelicDiagramMarkdown, type RelicConnectedDiagramDocument } from "../../../shared/diagramMarkdown";
import type { useT } from "../../i18n";

export function diagramCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return t("diagram.invalidStatus");

  const diagram = parsed.value as RelicConnectedDiagramDocument;

  return t("diagram.status", {
    lines: diagram.lines.length,
    nodes: diagram.nodes.length
  });
}
