import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactElement, RefObject } from "react";

import { clamp } from "../graphLayout";
import { useT } from "../i18n";
import { useGraphStore } from "../store/graphStore";
import {
  GraphDisplaySection,
  GraphFilterSection,
  GraphForcesSection,
  GraphGroupsSection
} from "./GraphControlSections";

interface GraphControlsProps {
  onDragHandlePointerDown?: (event: PointerEvent<HTMLElement>) => void;
  workspaceId: string | null;
}

export function useGraphFloatingPanelPosition(): {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties | undefined;
} {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return;

    const panel = panelRef.current;
    const container = panel?.parentElement;
    if (!panel || !container) return;

    event.preventDefault();
    event.stopPropagation();

    const panelRect = panel.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetX = event.clientX - panelRect.left;
    const offsetY = event.clientY - panelRect.top;

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const margin = 8;
      const maxX = Math.max(margin, containerRect.width - panelRect.width - margin);
      const maxY = Math.max(margin, containerRect.height - panelRect.height - margin);

      setPosition({
        x: clamp(moveEvent.clientX - containerRect.left - offsetX, margin, maxX),
        y: clamp(moveEvent.clientY - containerRect.top - offsetY, margin, maxY)
      });
    };

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };

    setPosition({
      x: clamp(panelRect.left - containerRect.left, 8, Math.max(8, containerRect.width - panelRect.width - 8)),
      y: clamp(panelRect.top - containerRect.top, 8, Math.max(8, containerRect.height - panelRect.height - 8))
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  return {
    onPointerDown,
    panelRef,
    style: position
      ? { left: position.x, right: "auto", top: position.y, transform: "none" }
      : undefined
  };
}

export function GraphControls({ onDragHandlePointerDown, workspaceId }: GraphControlsProps): ReactElement {
  const t = useT();
  const [isMinimized, setIsMinimized] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const {
    loadGraph,
    resetFilters
  } = useGraphStore();

  useEffect(() => {
    loadGraph(workspaceId);
  }, [loadGraph, workspaceId]);

  function toggleSection(section: string): void {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }));
  }

  if (isMinimized) {
    return (
      <button className="graph-controls-minimized" onClick={() => setIsMinimized(false)} title={t("graph.expand")} type="button">
        ⋯
      </button>
    );
  }

  return (
    <div className="graph-controls">
      <div className="graph-topbar">
        <div className="graph-topbar-title">
          {onDragHandlePointerDown ? (
            <button
              aria-label={t("graph.dragHandle")}
              className="hover-menu-drag-handle"
              onPointerDown={onDragHandlePointerDown}
              title={t("graph.dragHandle")}
              type="button"
            >
              <span />
            </button>
          ) : null}
          <div className="links-panel-subheading">{t("graph.title")}</div>
        </div>
        <div className="graph-topbar-actions">
          <button className="graph-icon-button" onClick={() => loadGraph(workspaceId, true)} title={t("graph.refresh")} type="button">
            ↻
          </button>
          <button className="graph-icon-button" onClick={() => setIsMinimized(true)} title={t("graph.collapse")} type="button">
            ×
          </button>
        </div>
      </div>

      <div className="graph-filters">
        <GraphFilterSection isOpen={!!openSections.filter} onToggle={() => toggleSection("filter")} />
        <GraphGroupsSection isOpen={!!openSections.groups} onToggle={() => toggleSection("groups")} />
        <GraphDisplaySection isOpen={!!openSections.display} onToggle={() => toggleSection("display")} />
        <GraphForcesSection isOpen={!!openSections.forces} onToggle={() => toggleSection("forces")} />
        <button className="graph-reset-button" onClick={resetFilters} type="button">
          {t("graph.reset")}
        </button>
      </div>
    </div>
  );
}
