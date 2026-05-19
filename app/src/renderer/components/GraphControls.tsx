import { useEffect, useState } from "react";
import type { ReactElement } from "react";

import { useT } from "../i18n";
import { useGraphStore } from "../store/graphStore";
import {
  GraphDisplaySection,
  GraphFilterSection,
  GraphForcesSection,
  GraphGroupsSection
} from "./GraphControlSections";

interface GraphControlsProps {
  workspaceId: string | null;
}

export function GraphControls({ workspaceId }: GraphControlsProps): ReactElement {
  const t = useT();
  const [isMinimized, setIsMinimized] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    display: true,
    filter: true,
    forces: true,
    groups: true
  });
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
      <button
        aria-label={t("graph.expand")}
        className="graph-controls-minimized"
        onClick={() => setIsMinimized(false)}
        title={t("graph.expand")}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width="18">
          <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.05.05a2.15 2.15 0 0 1-3.04 3.04l-.05-.05a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65v.14a2.15 2.15 0 0 1-4.3 0v-.08a1.8 1.8 0 0 0-1.18-1.68 1.8 1.8 0 0 0-1.98.36l-.05.05a2.15 2.15 0 1 1-3.04-3.04l.05-.05a1.8 1.8 0 0 0 .36-1.98 1.8 1.8 0 0 0-1.65-1.09h-.14a2.15 2.15 0 0 1 0-4.3h.08a1.8 1.8 0 0 0 1.68-1.18 1.8 1.8 0 0 0-.36-1.98l-.05-.05a2.15 2.15 0 1 1 3.04-3.04l.05.05a1.8 1.8 0 0 0 1.98.36h.02A1.8 1.8 0 0 0 9.35 2.2v-.1a2.15 2.15 0 0 1 4.3 0v.08a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.05-.05a2.15 2.15 0 0 1 3.04 3.04l-.05.05a1.8 1.8 0 0 0-.36 1.98v.02a1.8 1.8 0 0 0 1.65 1.09h.14a2.15 2.15 0 0 1 0 4.3h-.08A1.8 1.8 0 0 0 19.4 15Z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="graph-controls">
      <div className="graph-filters">
        <GraphFilterSection
          actions={(
            <div className="graph-section-actions">
              <button className="graph-icon-button" onClick={resetFilters} title={t("graph.reset")} type="button">
                ↻
              </button>
              <button className="graph-icon-button" onClick={() => setIsMinimized(true)} title={t("graph.collapse")} type="button">
                ×
              </button>
            </div>
          )}
          isOpen={!!openSections.filter}
          onToggle={() => toggleSection("filter")}
        />
        <GraphGroupsSection isOpen={!!openSections.groups} onToggle={() => toggleSection("groups")} />
        <GraphDisplaySection isOpen={!!openSections.display} onToggle={() => toggleSection("display")} />
        <GraphForcesSection isOpen={!!openSections.forces} onToggle={() => toggleSection("forces")} />
      </div>
    </div>
  );
}
