import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import {
  buildGraphFolders,
  buildGraphTags,
  clamp,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM
} from "../graphLayout";
import type { GraphLayoutMode } from "../graphLayout";
import { useT } from "../i18n";
import { useGraphStore, type GraphLinkFilter } from "../store/graphStore";

interface GraphSectionProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function GraphFilterSection({ isOpen, onToggle }: GraphSectionProps): ReactElement {
  const t = useT();
  const {
    folderFilter,
    graph,
    linkFilter,
    localGraphDepth,
    minDegree,
    query,
    setFolderFilter,
    setLinkFilter,
    setLocalGraphDepth,
    setMinDegree,
    setQuery,
    setTagFilter,
    tagFilter
  } = useGraphStore();
  const folders = useMemo(() => buildGraphFolders(graph), [graph]);
  const tags = useMemo(() => buildGraphTags(graph), [graph]);

  return (
    <GraphControlSection isOpen={isOpen} label={t("graph.filter")} onToggle={onToggle}>
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
  );
}

export function GraphGroupsSection({ isOpen, onToggle }: GraphSectionProps): ReactElement {
  const t = useT();
  const {
    addGroup,
    groups,
    removeGroup,
    updateGroup
  } = useGraphStore();

  return (
    <GraphControlSection isOpen={isOpen} label={t("graph.groups")} onToggle={onToggle}>
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
  );
}

export function GraphDisplaySection({ isOpen, onToggle }: GraphSectionProps): ReactElement {
  const t = useT();
  const {
    layoutMode,
    linkThickness,
    nodeSize,
    setLayoutMode,
    setLinkThickness,
    setNodeSize,
    setShowArrows,
    setShowLabels,
    setShowOrphans,
    setTextFadeThreshold,
    setZoom,
    showArrows,
    showLabels,
    showOrphans,
    textFadeThreshold,
    zoom
  } = useGraphStore();

  return (
    <GraphControlSection isOpen={isOpen} label={t("graph.viewSettings")} onToggle={onToggle}>
      <label className="setting-row">
        <span>{t("graph.layoutMode")}</span>
        <select onChange={(event) => setLayoutMode(event.target.value as GraphLayoutMode)} value={layoutMode}>
          <option value="standard">{t("graph.layoutStandard")}</option>
          <option value="radial">{t("graph.layoutRadial")}</option>
          <option value="cluster">{t("graph.layoutCluster")}</option>
          <option value="scatter">{t("graph.layoutScatter")}</option>
        </select>
      </label>
      <label className="setting-row"><span>{t("graph.zoom")}</span><input max={GRAPH_MAX_ZOOM} min={GRAPH_MIN_ZOOM} onChange={(event) => setZoom(clamp(Number(event.target.value), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM))} step="0.1" type="range" value={zoom} /></label>
      <label className="setting-row"><span>{t("graph.nodeSize")}</span><input max="1.8" min="0.6" onChange={(event) => setNodeSize(Number(event.target.value))} step="0.1" type="range" value={nodeSize} /></label>
      <label className="setting-row"><span>{t("graph.linkThickness")}</span><input max="2.2" min="0.5" onChange={(event) => setLinkThickness(Number(event.target.value))} step="0.1" type="range" value={linkThickness} /></label>
      <label className="setting-row"><span>{t("graph.textFade")}</span><input max="1.6" min="0.4" onChange={(event) => setTextFadeThreshold(Number(event.target.value))} step="0.1" type="range" value={textFadeThreshold} /></label>
      <label className="setting-row"><span>{t("graph.labels")}</span><input checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} type="checkbox" /></label>
      <label className="setting-row"><span>{t("graph.arrows")}</span><input checked={showArrows} onChange={(event) => setShowArrows(event.target.checked)} type="checkbox" /></label>
      <label className="setting-row"><span>{t("graph.showOrphans")}</span><input checked={showOrphans} onChange={(event) => setShowOrphans(event.target.checked)} type="checkbox" /></label>
    </GraphControlSection>
  );
}

export function GraphForcesSection({ isOpen, onToggle }: GraphSectionProps): ReactElement {
  const t = useT();
  const {
    centerForce,
    linkDistance,
    linkForce,
    repelForce,
    setCenterForce,
    setLinkDistance,
    setLinkForce,
    setRepelForce
  } = useGraphStore();

  return (
    <GraphControlSection isOpen={isOpen} label={t("graph.forces")} onToggle={onToggle}>
      <label className="setting-row"><span>{t("graph.centerForce")}</span><input max="2" min="0.2" onChange={(event) => setCenterForce(Number(event.target.value))} step="0.1" type="range" value={centerForce} /></label>
      <label className="setting-row"><span>{t("graph.repelForce")}</span><input max="2.2" min="0.4" onChange={(event) => setRepelForce(Number(event.target.value))} step="0.1" type="range" value={repelForce} /></label>
      <label className="setting-row"><span>{t("graph.linkForce")}</span><input max="2" min="0.3" onChange={(event) => setLinkForce(Number(event.target.value))} step="0.1" type="range" value={linkForce} /></label>
      <label className="setting-row"><span>{t("graph.linkDistance")}</span><input max="190" min="60" onChange={(event) => setLinkDistance(Number(event.target.value))} step="5" type="range" value={linkDistance} /></label>
    </GraphControlSection>
  );
}

export function GraphControlSection({
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
      {isOpen ? <div className="graph-control-section-body settings-stack">{children}</div> : null}
    </div>
  );
}
