import type { PointerEventHandler, ReactElement, RefObject } from "react";

import type { CardbookTimelineChart } from "../../shared/ipc";
import type { MinimapItem } from "../timelineTimeline";
import { useT } from "../i18n";

export interface TimelineMinimapProps {
  activeChart: CardbookTimelineChart | null;
  minimapItems: MinimapItem[];
  minimapRef: RefObject<HTMLDivElement | null>;
  minimapViewport: { leftPercent: number; widthPercent: number };
  onMinimapPointerDown: PointerEventHandler<HTMLDivElement>;
}

export function TimelineMinimap({
  activeChart,
  minimapItems,
  minimapRef,
  minimapViewport,
  onMinimapPointerDown
}: TimelineMinimapProps): ReactElement | null {
  const t = useT();

  if (!activeChart || minimapItems.length === 0) return null;

  return (
    <div className="timeline-minimap-panel">
      <span className="timeline-minimap-label">{t("timeline.overview")}</span>
      <div
        aria-label={t("timeline.minimap")}
        className="timeline-minimap"
        onPointerDown={onMinimapPointerDown}
        ref={minimapRef}
        role="slider"
      >
        {minimapItems.map((item) => (
          <span
            className="timeline-minimap-item"
            key={item.key}
            style={{ left: `${item.leftPercent}%`, width: `${item.widthPercent}%` }}
          />
        ))}
        <span
          className="timeline-minimap-window"
          style={{ left: `${minimapViewport.leftPercent}%`, width: `${minimapViewport.widthPercent}%` }}
        />
      </div>
    </div>
  );
}
