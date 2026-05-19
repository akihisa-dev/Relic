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
        <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 18 18" width="18">
          <line x1="4" x2="14" y1="5" y2="5" />
          <line x1="4" x2="14" y1="9" y2="9" />
          <line x1="4" x2="14" y1="13" y2="13" />
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
