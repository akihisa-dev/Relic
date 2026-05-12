import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import type { WorkspaceGraph, WorkspaceGraphEdge, WorkspaceGraphNode } from "../../shared/ipc";
import { useT } from "../i18n";

interface GraphSidebarProps {
  onOpenFile: (path: string) => void;
  workspaceId: string | null;
}

type LinkFilter = "all" | "linked" | "unlinked";

interface GraphPoint extends WorkspaceGraphNode {
  degree: number;
  incoming: number;
  outgoing: number;
  x: number;
  y: number;
}

interface GraphViewModel {
  edges: WorkspaceGraphEdge[];
  nodes: WorkspaceGraphNode[];
}

const GRAPH_WIDTH = 360;
const GRAPH_HEIGHT = 300;
const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;
const GRAPH_PADDING = 28;

export function GraphSidebar({ onOpenFile, workspaceId }: GraphSidebarProps): ReactElement {
  const t = useT();
  const [graph, setGraph] = useState<WorkspaceGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [folderFilter, setFolderFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [query, setQuery] = useState("");
  const [minDegree, setMinDegree] = useState(0);
  const [showLabels, setShowLabels] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadGraph = useCallback((): void => {
    if (!window.relic || !workspaceId) {
      setGraph(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    void window.relic.getWorkspaceGraph().then((result) => {
      setIsLoading(false);
      if (result.ok) {
        setGraph(result.value);
      } else {
        setGraph(null);
        setError(result.error.message);
      }
    });
  }, [workspaceId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const folders = useMemo(() => {
    if (!graph) return [];
    return [...new Set(graph.nodes.map((node) => node.folder).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ja"));
  }, [graph]);

  const tags = useMemo(() => {
    if (!graph) return [];
    return [...new Set(graph.nodes.flatMap((node) => node.tags))]
      .sort((a, b) => a.localeCompare(b, "ja"));
  }, [graph]);

  const graphStats = useMemo(() => graph ? buildGraphStats(graph.edges) : new Map<string, NodeStats>(), [graph]);

  const filteredGraph = useMemo<GraphViewModel>(() => {
    if (!graph) return { edges: [], nodes: [] };

    const normalizedQuery = query.trim().toLocaleLowerCase();

    const nodes = graph.nodes.filter((node) => {
      const stats = graphStats.get(node.path) ?? emptyNodeStats();
      const degree = stats.incoming + stats.outgoing;

      if (folderFilter && node.folder !== folderFilter) return false;
      if (tagFilter && !node.tags.includes(tagFilter)) return false;
      if (linkFilter === "linked" && degree === 0) return false;
      if (linkFilter === "unlinked" && degree > 0) return false;
      if (degree < minDegree) return false;
      if (
        normalizedQuery &&
        !node.name.toLocaleLowerCase().includes(normalizedQuery) &&
        !node.path.toLocaleLowerCase().includes(normalizedQuery)
      ) return false;
      return true;
    });
    const nodePaths = new Set(nodes.map((node) => node.path));
    const edges = graph.edges.filter((edge) => nodePaths.has(edge.sourcePath) && nodePaths.has(edge.targetPath));

    return { edges, nodes };
  }, [
    folderFilter,
    graph,
    graphStats,
    linkFilter,
    minDegree,
    query,
    tagFilter
  ]);

  const points = useMemo(
    () => layoutGraph(filteredGraph.nodes, filteredGraph.edges, selectedPath),
    [filteredGraph.edges, filteredGraph.nodes, selectedPath]
  );
  const pointByPath = useMemo(() => new Map(points.map((point) => [point.path, point])), [points]);
  const selectedNode = useMemo(
    () => filteredGraph.nodes.find((node) => node.path === selectedPath) ?? null,
    [filteredGraph.nodes, selectedPath]
  );
  const selectedLinks = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    const nodeByPath = new Map(filteredGraph.nodes.map((node) => [node.path, node]));

    return {
      incoming: filteredGraph.edges
        .filter((edge) => edge.targetPath === selectedNode.path)
        .map((edge) => nodeByPath.get(edge.sourcePath))
        .filter((node): node is WorkspaceGraphNode => !!node),
      outgoing: filteredGraph.edges
        .filter((edge) => edge.sourcePath === selectedNode.path)
        .map((edge) => nodeByPath.get(edge.targetPath))
        .filter((node): node is WorkspaceGraphNode => !!node)
    };
  }, [filteredGraph.edges, filteredGraph.nodes, selectedNode]);

  const resetFilters = (): void => {
    setFolderFilter("");
    setTagFilter("");
    setLinkFilter("all");
    setQuery("");
    setMinDegree(0);
  };

  return (
    <div className="graph-sidebar">
      <div className="graph-topbar">
        <div className="links-panel-subheading">{t("graph.title")}</div>
        <button className="graph-icon-button" onClick={loadGraph} title={t("graph.refresh")} type="button">
          ↻
        </button>
      </div>

      <div className="graph-filters">
        <label className="graph-search">
          <span>{t("graph.search")}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("graph.searchPlaceholder")}
            type="search"
            value={query}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.folder")}</span>
          <select onChange={(event) => setFolderFilter(event.target.value)} value={folderFilter}>
            <option value="">{t("graph.allFolders")}</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>{folder}</option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>{t("graph.tag")}</span>
          <select onChange={(event) => setTagFilter(event.target.value)} value={tagFilter}>
            <option value="">{t("graph.allTags")}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>{t("graph.links")}</span>
          <select onChange={(event) => setLinkFilter(event.target.value as LinkFilter)} value={linkFilter}>
            <option value="all">{t("graph.linksAll")}</option>
            <option value="linked">{t("graph.linksLinked")}</option>
            <option value="unlinked">{t("graph.linksUnlinked")}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t("graph.minLinks")}</span>
          <input
            max="20"
            min="0"
            onChange={(event) => setMinDegree(Number(event.target.value))}
            type="number"
            value={minDegree}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.zoom")}</span>
          <input
            max="1.8"
            min="0.7"
            onChange={(event) => setZoom(Number(event.target.value))}
            step="0.1"
            type="range"
            value={zoom}
          />
        </label>
        <label className="setting-row">
          <span>{t("graph.labels")}</span>
          <input
            checked={showLabels}
            onChange={(event) => setShowLabels(event.target.checked)}
            type="checkbox"
          />
        </label>
        <button className="graph-reset-button" onClick={resetFilters} type="button">
          {t("graph.reset")}
        </button>
      </div>

      <div className="graph-canvas" aria-label={t("graph.title")}>
        {isLoading ? (
          <div className="frontmatter-field-empty">{t("common.loading")}</div>
        ) : error ? (
          <div className="frontmatter-field-empty">{error}</div>
        ) : points.length === 0 ? (
          <div className="frontmatter-field-empty">{t("graph.empty")}</div>
        ) : (
          <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="img">
            <g transform={`translate(${GRAPH_CENTER_X * (1 - zoom)} ${GRAPH_CENTER_Y * (1 - zoom)}) scale(${zoom})`}>
              <g className="graph-edge-layer">
                {filteredGraph.edges.map((edge) => {
                  const source = pointByPath.get(edge.sourcePath);
                  const target = pointByPath.get(edge.targetPath);
                  if (!source || !target) return null;
                  const isSelected = selectedPath === edge.sourcePath || selectedPath === edge.targetPath;
                  return (
                    <line
                      className={isSelected ? "graph-edge graph-edge--selected" : "graph-edge"}
                      key={`${edge.sourcePath}-${edge.targetPath}`}
                      x1={source.x}
                      x2={target.x}
                      y1={source.y}
                      y2={target.y}
                    />
                  );
                })}
              </g>
              <g className="graph-node-layer">
                {points.map((point) => {
                  const isSelected = point.path === selectedPath;
                  const radius = Math.min(11, 4.5 + Math.sqrt(point.degree) * 2.3);

                  return (
                    <g
                      aria-label={point.name}
                      className="graph-node-hit"
                      key={point.path}
                      onClick={() => setSelectedPath(point.path)}
                      onDoubleClick={() => onOpenFile(point.path)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          onOpenFile(point.path);
                        }
                        if (event.key === " ") {
                          event.preventDefault();
                          setSelectedPath(point.path);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <circle
                        className={[
                          "graph-node",
                          isSelected ? "graph-node--selected" : ""
                        ].filter(Boolean).join(" ")}
                        cx={point.x}
                        cy={point.y}
                        r={radius}
                      />
                      {showLabels ? (
                        <text x={point.x + radius + 4} y={point.y + 4}>{point.name}</text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}
      </div>

      <div className="graph-summary">
        {t("graph.summary", { edges: filteredGraph.edges.length, nodes: filteredGraph.nodes.length })}
      </div>

      <div className="graph-detail">
        {selectedNode ? (
          <>
            <button className="graph-detail-title" onClick={() => onOpenFile(selectedNode.path)} type="button">
              <span>{selectedNode.name}</span>
              <span>{selectedNode.path}</span>
            </button>
            {selectedNode.tags.length > 0 ? (
              <div className="graph-tag-list">
                {selectedNode.tags.map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
            ) : null}
            <GraphLinkList
              emptyLabel={t("graph.noOutgoing")}
              label={t("graph.outgoing")}
              nodes={selectedLinks.outgoing}
              onOpenFile={onOpenFile}
            />
            <GraphLinkList
              emptyLabel={t("graph.noIncoming")}
              label={t("graph.incoming")}
              nodes={selectedLinks.incoming}
              onOpenFile={onOpenFile}
            />
          </>
        ) : (
          <div className="frontmatter-field-empty">{t("graph.selectNode")}</div>
        )}
      </div>
    </div>
  );
}

function GraphLinkList({
  emptyLabel,
  label,
  nodes,
  onOpenFile
}: {
  emptyLabel: string;
  label: string;
  nodes: WorkspaceGraphNode[];
  onOpenFile: (path: string) => void;
}): ReactElement {
  return (
    <div className="graph-link-list">
      <div className="graph-link-list-title">{label}</div>
      {nodes.length === 0 ? (
        <div className="graph-link-empty">{emptyLabel}</div>
      ) : (
        nodes.map((node) => (
          <button key={node.path} onClick={() => onOpenFile(node.path)} title={node.path} type="button">
            {node.name}
          </button>
        ))
      )}
    </div>
  );
}

interface NodeStats {
  incoming: number;
  outgoing: number;
}

function emptyNodeStats(): NodeStats {
  return { incoming: 0, outgoing: 0 };
}

function buildGraphStats(edges: WorkspaceGraphEdge[]): Map<string, NodeStats> {
  const stats = new Map<string, NodeStats>();

  for (const edge of edges) {
    const source = stats.get(edge.sourcePath) ?? emptyNodeStats();
    const target = stats.get(edge.targetPath) ?? emptyNodeStats();
    source.outgoing += 1;
    target.incoming += 1;
    stats.set(edge.sourcePath, source);
    stats.set(edge.targetPath, target);
  }

  return stats;
}

function layoutGraph(
  nodes: WorkspaceGraphNode[],
  edges: WorkspaceGraphEdge[],
  selectedPath: string | null
): GraphPoint[] {
  const stats = buildGraphStats(edges);
  const initial = nodes.map((node, index) => {
    const nodeStats = stats.get(node.path) ?? emptyNodeStats();
    const degree = nodeStats.incoming + nodeStats.outgoing;
    const angle = (Math.PI * 2 * index) / Math.max(1, nodes.length) - Math.PI / 2;
    const radius = 86 + (index % 4) * 12;

    return {
      ...node,
      degree,
      incoming: nodeStats.incoming,
      outgoing: nodeStats.outgoing,
      x: GRAPH_CENTER_X + Math.cos(angle) * radius,
      y: GRAPH_CENTER_Y + Math.sin(angle) * radius
    };
  });

  if (initial.length <= 1) {
    return initial.map((node) => ({ ...node, x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y }));
  }

  const linkedPairs = edges
    .map((edge) => ({
      sourceIndex: initial.findIndex((node) => node.path === edge.sourcePath),
      targetIndex: initial.findIndex((node) => node.path === edge.targetPath)
    }))
    .filter((edge) => edge.sourceIndex >= 0 && edge.targetIndex >= 0);

  for (let tick = 0; tick < 72; tick += 1) {
    const forces = initial.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < initial.length; i += 1) {
      for (let j = i + 1; j < initial.length; j += 1) {
        const dx = initial[j].x - initial[i].x || 0.01;
        const dy = initial[j].y - initial[i].y || 0.01;
        const distanceSquared = Math.max(64, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSquared);
        const strength = 520 / distanceSquared;
        const fx = (dx / distance) * strength;
        const fy = (dy / distance) * strength;
        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }
    }

    for (const edge of linkedPairs) {
      const source = initial[edge.sourceIndex];
      const target = initial[edge.targetIndex];
      const dx = target.x - source.x || 0.01;
      const dy = target.y - source.y || 0.01;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const preferred = 68;
      const strength = (distance - preferred) * 0.018;
      const fx = (dx / distance) * strength;
      const fy = (dy / distance) * strength;
      forces[edge.sourceIndex].x += fx;
      forces[edge.sourceIndex].y += fy;
      forces[edge.targetIndex].x -= fx;
      forces[edge.targetIndex].y -= fy;
    }

    for (let i = 0; i < initial.length; i += 1) {
      const node = initial[i];
      const isPinned = node.path === selectedPath;
      const centerStrength = isPinned ? 0.12 : 0.025;
      forces[i].x += (GRAPH_CENTER_X - node.x) * centerStrength;
      forces[i].y += (GRAPH_CENTER_Y - node.y) * centerStrength;
      node.x = clamp(node.x + forces[i].x, GRAPH_PADDING, GRAPH_WIDTH - GRAPH_PADDING);
      node.y = clamp(node.y + forces[i].y, GRAPH_PADDING, GRAPH_HEIGHT - GRAPH_PADDING);
    }
  }

  return initial.sort((a, b) => {
    if (a.path === selectedPath) return 1;
    if (b.path === selectedPath) return -1;
    return a.path.localeCompare(b.path, "ja");
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
