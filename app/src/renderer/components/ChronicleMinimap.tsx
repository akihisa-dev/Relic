import type { PointerEventHandler, ReactElement, RefObject } from "react";

import type { WorkspaceChart } from "../../shared/ipc";
import type { MinimapItem } from "../chronicleTimeline";
import { useT } from "../i18n";

export interface ChronicleMinimapProps {
  activeChart: WorkspaceChart | null;
  minimapItems: MinimapItem[];
  minimapRef: RefObject<HTMLDivElement | null>;
  minimapViewport: { leftPercent: number; widthPercent: number };
  onMinimapPointerDown: PointerEventHandler<HTMLDivElement>;
}

export function ChronicleMinimap({
  activeChart,
  minimapItems,
  minimapRef,
  minimapViewport,
  onMinimapPointerDown
}: ChronicleMinimapProps): ReactElement | null {
  const t = useT();

  if (!activeChart || minimapItems.length === 0) return null;

  return (
    <div className="chronicle-minimap-panel">
      <span className="chronicle-minimap-label">{t("chronicle.overview")}</span>
      <div
        aria-label={t("chronicle.minimap")}
        className="chronicle-minimap"
        onPointerDown={onMinimapPointerDown}
        ref={minimapRef}
        role="slider"
      >
        {minimapItems.map((item) => (
          <span
            className="chronicle-minimap-item"
            key={item.key}
            style={{ left: `${item.leftPercent}%`, width: `${item.widthPercent}%` }}
          />
        ))}
        <span
          className="chronicle-minimap-window"
          style={{ left: `${minimapViewport.leftPercent}%`, width: `${minimapViewport.widthPercent}%` }}
        />
      </div>
    </div>
  );
}
