import { type ReactElement, useMemo } from "react";

import { parseRelicDiagramMarkdown, type RelicConnectedDiagramDocument } from "../../../shared/diagramMarkdown";
import { useT } from "../../i18n";
import { DiagramCanvasSurface } from "./DiagramCanvasSurface";
import { type DiagramCanvasProps } from "./diagramTypes";

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

  return (
    <DiagramCanvasSurface
      content={content}
      diagram={parsed.value as RelicConnectedDiagramDocument}
      fileName={fileName}
      onChange={onChange}
    />
  );
}
