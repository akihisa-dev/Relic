import { type ReactElement, useMemo } from "react";

import { parseRelicDiagramMarkdown } from "../../../shared/diagramMarkdown";
import { useT } from "../../i18n";
import { RelationshipCanvas } from "./RelationshipCanvas";
import { type DiagramCanvasProps } from "./diagramTypes";
import { WhyTreeEditor } from "./WhyTreeEditor";

export function DiagramCanvasRouter({ content, fileName, onChange }: DiagramCanvasProps): ReactElement {
  const t = useT();
  const parsed = useMemo(() => parseRelicDiagramMarkdown(content), [content]);

  if (!parsed.ok) {
    return (
      <div className="diagram-canvas diagram-canvas--invalid" role="alert">
        <p>{t("diagram.invalidFile")}</p>
      </div>
    );
  }

  if (parsed.value.type === "why-tree") {
    return (
      <WhyTreeEditor
        content={content}
        fileName={fileName}
        onChange={onChange}
        tree={parsed.value}
      />
    );
  }

  return (
    <RelationshipCanvas
      content={content}
      diagram={parsed.value}
      fileName={fileName}
      onChange={onChange}
    />
  );
}
