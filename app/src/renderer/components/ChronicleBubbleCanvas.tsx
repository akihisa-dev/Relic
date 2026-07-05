import { useMemo, useState, type ReactElement } from "react";

import type { ChartEntry } from "../../shared/ipc";
import { buildChronicleBubbleLayout, type ChronicleBubbleShape } from "../chronicleBubbleLayout";
import { useT } from "../i18n";

interface ChronicleBubbleCanvasProps {
  entries: ChartEntry[];
  onOpenFile: (path: string) => void;
}

export function ChronicleBubbleCanvas({
  entries,
  onOpenFile
}: ChronicleBubbleCanvasProps): ReactElement {
  const t = useT();
  const layout = useMemo(() => buildChronicleBubbleLayout(entries), [entries]);
  const [hoveredShape, setHoveredShape] = useState<ChronicleBubbleShape | null>(null);

  if (entries.length === 0) {
    return <div className="frontmatter-field-empty">{t("chronicle.empty")}</div>;
  }

  return (
    <div className="chronicle-bubble-view">
      <div className="chronicle-bubble-scroll">
        <div
          aria-label={t("chronicle.bubbleViewLabel")}
          className="chronicle-bubble-stage"
          style={{
            height: layout.height,
            width: layout.width
          }}
        >
          {layout.shapes.map((shape) => (
            <button
              className="chronicle-bubble-item"
              data-hovered={shape.id === hoveredShape?.id}
              key={shape.id}
              onClick={() => onOpenFile(shape.entry.path)}
              onMouseEnter={() => setHoveredShape(shape)}
              onMouseLeave={() => setHoveredShape(null)}
              style={{
                height: shape.height,
                left: shape.x,
                top: shape.y,
                width: shape.width
              }}
              type="button"
            >
              {shape.label}
            </button>
          ))}
        </div>
        {hoveredShape ? (
          <div
            className="chronicle-bubble-tooltip"
            style={{
              left: hoveredShape.x,
              top: hoveredShape.y + hoveredShape.height + 8
            }}
          >
            <strong>{hoveredShape.entry.fileName}</strong>
            <span>{hoveredShape.entry.chronicleCalendarName}: {hoveredShape.entry.startLabel} - {hoveredShape.entry.endLabel}</span>
            <span>{hoveredShape.category ?? t("chronicle.categoryUnset")}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
