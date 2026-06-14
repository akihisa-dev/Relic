import { type ReactElement, useMemo } from "react";

import { parseRelicDiagramMarkdown } from "../../shared/diagramMarkdown";
import { useT } from "../i18n";
import { type DiagramCanvasProps } from "./diagram/diagramTypes";
import { RelationshipCanvas } from "./diagram/RelationshipCanvas";
import { countWhyTreeItems, WhyTreeEditor } from "./diagram/WhyTreeEditor";

export function DiagramCanvas({ content, fileName, onChange }: DiagramCanvasProps): ReactElement {
  const t = useT();
  const parsed = useMemo(() => parseRelicDiagramMarkdown(content), [content]);

  if (!parsed.ok) {
    return (
      <div className="diagram-canvas diagram-canvas--invalid" role="alert">
        <p>{t("diagram.invalidFile")}</p>
      </div>
    );
  }

  return parsed.value.type === "why-tree" ? (
    <WhyTreeEditor content={content} fileName={fileName} onChange={onChange} tree={parsed.value} />
  ) : (
    <RelationshipCanvas content={content} diagram={parsed.value} fileName={fileName} onChange={onChange} />
  );
}

export function diagramCanvasStatus(content: string, t: ReturnType<typeof useT>): string {
  const parsed = parseRelicDiagramMarkdown(content);
  if (!parsed.ok) return t("diagram.invalidStatus");

  if (parsed.value.type === "why-tree") {
    const counts = countWhyTreeItems(parsed.value);
    return t("diagram.whyTreeStatus", counts);
  }

  return t("diagram.status", {
    lines: parsed.value.lines.length,
    nodes: parsed.value.nodes.length
  });
}
