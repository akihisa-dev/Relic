import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent, ReactElement, ReactNode, RefObject } from "react";

import {
  buildGraphFolders,
  buildGraphTags,
  clamp,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM
} from "../graphLayout";
import { useT } from "../i18n";
import { useGraphStore, type GraphLinkFilter } from "../store/graphStore";

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
    addGroup,
    centerForce,
    folderFilter,
    graph,
    groups,
    linkDistance,
    linkFilter,
    linkForce,
    linkThickness,
    localGraphDepth,
    loadGraph,
    minDegree,
    nodeSize,
    query,
    removeGroup,
    resetFilters,
    setCenterForce,
    setFolderFilter,
    setLinkDistance,
    setLinkFilter,
    setLinkForce,
    setLinkThickness,
    setLocalGraphDepth,
    setMinDegree,
    setNodeSize,
    setQuery,
    setRepelForce,
    setShowArrows,
    setShowLabels,
    setShowOrphans,
    setTagFilter,
    setTextFadeThreshold,
    setZoom,
    showArrows,
    showLabels,
    showOrphans,
    tagFilter,
    textFadeThreshold,
    repelForce,
    updateGroup,
    zoom
  } = useGraphStore();

  useEffect(() => {
    loadGraph(workspaceId);
  }, [loadGraph, workspaceId]);

  const folders = useMemo(() => buildGraphFolders(graph), [graph]);
  const tags = useMemo(() => buildGraphTags(graph), [graph]);

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
        <GraphControlSection isOpen={!!openSections.filter} label={t("graph.filter")} onToggle={() => toggleSection("filter")}>
          <label className="graph-search">
            <span>{t("graph.search")}</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder={t("graph.searchPlaceholder")} type="search" value={query} />
          </label>
          <label className="setting-row">
            <span>{t("graph.folder")}</span>
            <select onChange={(event) => setFolderFilter(event.target.value)} value={folderFilter}>
              <option value="">{t("graph.allFolders")}</option>
              {folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
            </select>
          </label>
          <label className="setting-row">
            <span>{t("graph.tag")}</span>
            <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
              <option value="">{t("graph.allTags")}</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
          </label>
          <label className="setting-row">
            <span>{t("graph.links")}</span>
            <select onChange={(event) => setLinkFilter(event.target.value as GraphLinkFilter)} value={linkFilter}>
              <option value="all">{t("graph.linksAll")}</option>
              <option value="linked">{t("graph.linksLinked")}</option>
              <option value="unlinked">{t("graph.linksUnlinked")}</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{t("graph.minLinks")}</span>
            <input max="20" min="0" onChange={(event) => setMinDegree(Number(event.target.value))} type="number" value={minDegree} />
          </label>
          <label className="setting-row">
            <span>{t("graph.localDepth")}</span>
            <input max="3" min="0" onChange={(event) => setLocalGraphDepth(Number(event.target.value))} type="number" value={localGraphDepth} />
          </label>
        </GraphControlSection>

        <GraphControlSection isOpen={!!openSections.groups} label={t("graph.groups")} onToggle={() => toggleSection("groups")}>
          <div className="graph-group-heading">
            <span>{t("graph.groups")}</span>
            <button className="graph-mini-button" onClick={addGroup} type="button">{t("graph.groupAdd")}</button>
          </div>
          {groups.map((group) => (
            <div className="graph-group-row" key={group.id}>
              <input aria-label={t("graph.groupColor")} className="graph-group-color" onChange={(event) => updateGroup(group.id, { color: event.target.value })} type="color" value={group.color} />
              <input aria-label={t("graph.groupQuery")} onChange={(event) => updateGroup(group.id, { query: event.target.value })} placeholder={t("graph.searchSyntaxHint")} type="search" value={group.query} />
              <button aria-label={t("graph.groupRemove")} className="graph-mini-button graph-mini-button--icon" onClick={() => removeGroup(group.id)} type="button">×</button>
            </div>
          ))}
        </GraphControlSection>

        <GraphControlSection isOpen={!!openSections.display} label={t("graph.viewSettings")} onToggle={() => toggleSection("display")}>
          <label className="setting-row"><span>{t("graph.zoom")}</span><input max="1.8" min="0.7" onChange={(event) => setZoom(clamp(Number(event.target.value), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM))} step="0.1" type="range" value={zoom} /></label>
          <label className="setting-row"><span>{t("graph.nodeSize")}</span><input max="1.8" min="0.6" onChange={(event) => setNodeSize(Number(event.target.value))} step="0.1" type="range" value={nodeSize} /></label>
          <label className="setting-row"><span>{t("graph.linkThickness")}</span><input max="2.2" min="0.5" onChange={(event) => setLinkThickness(Number(event.target.value))} step="0.1" type="range" value={linkThickness} /></label>
          <label className="setting-row"><span>{t("graph.textFade")}</span><input max="1.6" min="0.4" onChange={(event) => setTextFadeThreshold(Number(event.target.value))} step="0.1" type="range" value={textFadeThreshold} /></label>
          <label className="setting-row"><span>{t("graph.labels")}</span><input checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} type="checkbox" /></label>
          <label className="setting-row"><span>{t("graph.arrows")}</span><input checked={showArrows} onChange={(event) => setShowArrows(event.target.checked)} type="checkbox" /></label>
          <label className="setting-row"><span>{t("graph.showOrphans")}</span><input checked={showOrphans} onChange={(event) => setShowOrphans(event.target.checked)} type="checkbox" /></label>
        </GraphControlSection>

        <GraphControlSection isOpen={!!openSections.forces} label={t("graph.forces")} onToggle={() => toggleSection("forces")}>
          <label className="setting-row"><span>{t("graph.centerForce")}</span><input max="2" min="0.2" onChange={(event) => setCenterForce(Number(event.target.value))} step="0.1" type="range" value={centerForce} /></label>
          <label className="setting-row"><span>{t("graph.repelForce")}</span><input max="2.2" min="0.4" onChange={(event) => setRepelForce(Number(event.target.value))} step="0.1" type="range" value={repelForce} /></label>
          <label className="setting-row"><span>{t("graph.linkForce")}</span><input max="2" min="0.3" onChange={(event) => setLinkForce(Number(event.target.value))} step="0.1" type="range" value={linkForce} /></label>
          <label className="setting-row"><span>{t("graph.linkDistance")}</span><input max="190" min="60" onChange={(event) => setLinkDistance(Number(event.target.value))} step="5" type="range" value={linkDistance} /></label>
        </GraphControlSection>
        <button className="graph-reset-button" onClick={resetFilters} type="button">
          {t("graph.reset")}
        </button>
      </div>
    </div>
  );
}

function GraphControlSection({
  children,
  isOpen,
  label,
  onToggle
}: {
  children: ReactNode;
  isOpen: boolean;
  label: string;
  onToggle: () => void;
}): ReactElement {
  return (
    <div className="graph-control-section">
      <button className="graph-control-section-title" onClick={onToggle} type="button">
        <span>{isOpen ? "⌄" : "›"}</span>
        <span>{label}</span>
      </button>
      {isOpen ? <div className="graph-control-section-body">{children}</div> : null}
    </div>
  );
}
