import type { ChangeEvent, ReactElement } from "react";

import type {
  GraphColorGroup,
  GraphControlSectionId,
  GraphOptions,
  GraphSectionCollapsedState
} from "../graph/graphTypes";
import type { Translator } from "../i18nModel";

export function GraphControls({
  colorGroups,
  controlsOpen,
  draggingColorGroupId,
  nodeCount,
  onAddColorGroup,
  onAnimate,
  onColorGroupChange,
  onColorGroupDelete,
  onColorGroupDragEnd,
  onColorGroupDragStart,
  onColorGroupMove,
  onOptionsChange,
  onReset,
  onSectionCollapsedChange,
  onToggleControls,
  options,
  sectionCollapsed,
  t
}: {
  colorGroups: GraphColorGroup[];
  controlsOpen: boolean;
  draggingColorGroupId: string | null;
  nodeCount: number;
  onAddColorGroup: () => void;
  onAnimate: () => void;
  onColorGroupChange: (groupId: string, patch: Partial<GraphColorGroup>) => void;
  onColorGroupDelete: (groupId: string) => void;
  onColorGroupDragEnd: () => void;
  onColorGroupDragStart: (groupId: string) => void;
  onColorGroupMove: (targetGroupId: string) => void;
  onOptionsChange: (patch: Partial<GraphOptions>) => void;
  onReset: () => void;
  onSectionCollapsedChange: (sectionId: GraphControlSectionId, collapsed: boolean) => void;
  onToggleControls: () => void;
  options: GraphOptions;
  sectionCollapsed: GraphSectionCollapsedState;
  t: Translator;
}): ReactElement {
  return (
    <aside className={`graph-controls${controlsOpen ? "" : " is-close"}`} data-ignore-swipe="true">
      <button
        aria-label={controlsOpen ? t("graph.closeSettings") : t("graph.openSettings")}
        className={`graph-controls-button ${controlsOpen ? "mod-close" : "mod-open"}`}
        onClick={onToggleControls}
        title={controlsOpen ? t("graph.close") : t("graph.open")}
        type="button"
      >
        {controlsOpen ? <GraphControlIcon name="close" /> : <GraphControlIcon name="settings" />}
      </button>
      <button
        aria-label={t("graph.playTimelapseAria")}
        className="graph-controls-button mod-animate"
        onClick={onAnimate}
        title={t("graph.playTimelapse")}
        type="button"
      >
        <GraphControlIcon name="wand" />
      </button>
      <button
        aria-label={t("graph.resetSettings")}
        className="graph-controls-button mod-reset"
        onClick={onReset}
        title={t("graph.resetToDefaults")}
        type="button"
      >
        <GraphControlIcon name="reset" />
      </button>
      <GraphControlSection
        collapsed={sectionCollapsed.filter}
        id="filter"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.filters")}
      >
        <input
          aria-label={t("graph.filterNodes")}
          className="graph-search-input"
          onChange={(event) => onOptionsChange({ search: event.target.value })}
          placeholder={t("graph.searchNodesPlaceholder")}
          type="search"
          value={options.search}
        />
        <GraphToggle label={t("graph.tags")} onChange={(showTags) => onOptionsChange({ showTags })} value={options.showTags} />
        <GraphToggle
          label={t("graph.attachments")}
          onChange={(showAttachments) => onOptionsChange({ showAttachments })}
          value={options.showAttachments}
        />
        <GraphToggle
          label={t("graph.existingFilesOnly")}
          onChange={(hideUnresolved) => onOptionsChange({ hideUnresolved })}
          value={options.hideUnresolved}
        />
        <GraphToggle label={t("graph.orphans")} onChange={(showOrphans) => onOptionsChange({ showOrphans })} value={options.showOrphans} />
      </GraphControlSection>
      <GraphControlSection
        collapsed={sectionCollapsed.groups}
        id="groups"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.groups")}
      >
        <div className="graph-color-groups-container">
          {colorGroups.map((group) => (
            <div
              className={`graph-color-group${draggingColorGroupId === group.id ? " is-dragging" : ""}`}
              key={group.id}
              onDragOver={(event) => {
                event.preventDefault();
                onColorGroupMove(group.id);
              }}
            >
              <button
                aria-label={t("graph.reorderGroup")}
                className="graph-color-group-drag"
                draggable
                onDragEnd={onColorGroupDragEnd}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", group.id);
                  onColorGroupDragStart(group.id);
                }}
                title={t("graph.dragToReorder")}
                type="button"
              >
                <GraphControlIcon name="grip" />
              </button>
              <input
                aria-label={t("graph.groupQuery")}
                onChange={(event) => onColorGroupChange(group.id, { query: event.target.value })}
                placeholder={t("graph.groupQueryPlaceholder")}
                type="text"
                value={group.query}
              />
              <input
                aria-label={t("graph.groupColor")}
                onChange={(event: ChangeEvent<HTMLInputElement>) => onColorGroupChange(group.id, { color: event.target.value })}
                type="color"
                value={group.color}
              />
              <button aria-label={t("graph.deleteGroup")} onClick={() => onColorGroupDelete(group.id)} type="button">
                <GraphControlIcon name="trash" />
              </button>
            </div>
          ))}
        </div>
        <button className="graph-cta-button" onClick={onAddColorGroup} type="button">{t("graph.newGroup")}</button>
      </GraphControlSection>
      <GraphControlSection
        collapsed={sectionCollapsed.display}
        id="display"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.display")}
      >
        <GraphToggle label={t("graph.arrows")} onChange={(showArrows) => onOptionsChange({ showArrows })} value={options.showArrows} />
        <GraphSlider label={t("graph.textFadeThreshold")} max={3} min={-3} onChange={(textFadeMultiplier) => onOptionsChange({ textFadeMultiplier })} step={0.1} value={options.textFadeMultiplier} />
        <GraphSlider label={t("graph.nodeSize")} max={5} min={0.1} onChange={(nodeSizeMultiplier) => onOptionsChange({ nodeSizeMultiplier })} step={0.1} value={options.nodeSizeMultiplier} />
        <GraphSlider label={t("graph.linkThickness")} max={5} min={0.1} onChange={(lineSizeMultiplier) => onOptionsChange({ lineSizeMultiplier })} step={0.1} value={options.lineSizeMultiplier} />
        <button className="graph-cta-button" onClick={onAnimate} type="button">{t("graph.animateTimelapse")}</button>
      </GraphControlSection>
      <GraphControlSection
        collapsed={sectionCollapsed.forces}
        id="forces"
        onCollapsedChange={onSectionCollapsedChange}
        title={t("graph.forces")}
      >
        <GraphSlider label={t("graph.centerForce")} max={1} min={0} onChange={(centerStrength) => onOptionsChange({ centerStrength })} step={0.01} value={options.centerStrength} />
        <GraphSlider label={t("graph.repelForce")} max={20} min={0} onChange={(repelStrength) => onOptionsChange({ repelStrength })} step={0.1} value={options.repelStrength} />
        <GraphSlider label={t("graph.linkForce")} max={1} min={0} onChange={(linkStrength) => onOptionsChange({ linkStrength })} step={0.01} value={options.linkStrength} />
        <GraphSlider label={t("graph.linkDistance")} max={500} min={30} onChange={(linkDistance) => onOptionsChange({ linkDistance })} step={1} value={options.linkDistance} />
      </GraphControlSection>
      <div className="graph-control-count">{t("graph.nodeCount", { count: nodeCount })}</div>
    </aside>
  );
}

function GraphControlIcon({ name }: { name: "close" | "grip" | "reset" | "settings" | "trash" | "triangle" | "wand" }): ReactElement {
  if (name === "grip") {
    return (
      <svg aria-hidden="true" fill="currentColor" height="14" viewBox="0 0 24 24" width="14">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    );
  }

  if (name === "triangle") {
    return (
      <svg aria-hidden="true" fill="currentColor" height="12" viewBox="0 0 24 24" width="12">
        <path d="M9 6l6 6-6 6z" />
      </svg>
    );
  }

  if (name === "close") {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    );
  }

  if (name === "reset") {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <path d="M3 12a9 9 0 1 0 3-6.708" />
        <path d="M3 3v6h6" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    );
  }

  if (name === "wand") {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
        <path d="M15 4V2" />
        <path d="M15 16v-2" />
        <path d="M8 9H6" />
        <path d="M20 9h-2" />
        <path d="m17.8 6.2 1.4-1.4" />
        <path d="m10.8 13.2-1.4 1.4" />
        <path d="m10.8 4.8-1.4-1.4" />
        <path d="m17.8 11.8 1.4 1.4" />
        <path d="m3 21 9-9" />
        <path d="m12 12 3-3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function GraphControlSection({
  children,
  collapsed,
  id,
  onCollapsedChange,
  title
}: {
  children: React.ReactNode;
  collapsed: boolean;
  id: GraphControlSectionId;
  onCollapsedChange: (sectionId: GraphControlSectionId, collapsed: boolean) => void;
  title: string;
}): ReactElement {
  return (
    <section className={`graph-control-section mod-${id}${collapsed ? " is-collapsed" : ""}`}>
      <button
        aria-expanded={!collapsed}
        className="graph-control-section-header"
        onClick={() => onCollapsedChange(id, !collapsed)}
        type="button"
      >
        <span className="graph-control-section-icon">
          <GraphControlIcon name="triangle" />
        </span>
        <span>{title}</span>
      </button>
      <div className="graph-control-section-children" hidden={collapsed}>{children}</div>
    </section>
  );
}

function GraphToggle({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: boolean }): ReactElement {
  return (
    <label className="graph-setting-item graph-setting-item--toggle">
      <span>{label}</span>
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

function GraphSlider({
  label,
  max,
  min,
  onChange,
  step,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}): ReactElement {
  return (
    <label className="graph-setting-item graph-setting-item--slider">
      <span>{label}</span>
      <input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="range" value={value} />
    </label>
  );
}
