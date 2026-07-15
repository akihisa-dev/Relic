import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import type { WorkspaceGraph } from "../../shared/ipc";
import { createSphereData, type SphereData } from "../sphere/sphereModel";
import { createSphereRuntime, type SphereRuntime } from "../sphere/sphereRuntime";
import { deriveVisibleGraph } from "../graph/graphDisplayModel";
import { graphNodePrimaryAction } from "../graph/graphSearchModel";
import { defaultGraphDrawTheme, type GraphDrawTheme } from "../graph/graphTypes";
import { loadGraphColorGroups, loadGraphOptions, readGraphDrawTheme } from "../graph/graphViewRuntime";
import { useLatest } from "../hooks/useLatest";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";

interface SphereViewProps {
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  refreshRevision?: number;
}

export function SphereView({ onOpenFile, onOpenTagSearch, refreshRevision = 0 }: SphereViewProps): ReactElement {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SphereRuntime | null>(null);
  const dataRef = useRef<SphereData>({ links: [], nodes: [] });
  const themeRef = useRef<GraphDrawTheme>(defaultGraphDrawTheme);
  const openFileRef = useLatest(onOpenFile);
  const openTagSearchRef = useLatest(onOpenTagSearch);
  const [graphState, setGraphState] = useState<{
    error: string | null;
    graph: WorkspaceGraph | null;
    loading: boolean;
  }>(() => relicClient.current
    ? { error: null, graph: null, loading: true }
    : { error: t("sphere.loadFailed"), graph: null, loading: false });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [theme, setTheme] = useState<GraphDrawTheme>(defaultGraphDrawTheme);
  const options = useMemo(loadGraphOptions, []);
  const colorGroups = useMemo(loadGraphColorGroups, []);
  const filteredGraph = useMemo(
    () => deriveVisibleGraph(graphState.graph, options),
    [graphState.graph, options]
  );
  const sphereData = useMemo(
    () => createSphereData(filteredGraph, colorGroups, theme),
    [colorGroups, filteredGraph, theme]
  );
  const focusId = pinnedNodeId ?? hoveredNodeId;
  const focusedNode = focusId
    ? filteredGraph.nodes.find((node) => node.id === focusId) ?? null
    : null;

  dataRef.current = sphereData;
  themeRef.current = theme;

  useEffect(() => {
    const updateTheme = () => setTheme(readGraphDrawTheme(document.documentElement));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const colorScheme = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
    const handleColorSchemeChange = () => {
      if (!document.documentElement.hasAttribute("data-theme")) updateTheme();
    };
    colorScheme?.addEventListener("change", handleColorSchemeChange);

    return () => {
      observer.disconnect();
      colorScheme?.removeEventListener("change", handleColorSchemeChange);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!relicClient.current) return () => {
      active = false;
    };

    void relicClient.current.getWorkspaceGraph().then((result) => {
      if (!active) return;
      if (result.ok) {
        setGraphState({ error: null, graph: result.value, loading: false });
        return;
      }
      setGraphState({ error: result.error.message, graph: null, loading: false });
    }).catch(() => {
      if (active) setGraphState({ error: t("sphere.loadFailed"), graph: null, loading: false });
    });

    return () => {
      active = false;
    };
  }, [refreshRevision, t]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    try {
      const runtime = createSphereRuntime(host, {
        canvasLabel: t("sphere.canvasLabel"),
        onBackgroundFocusClear: () => setPinnedNodeId(null),
        onContextLost: () => {
          runtimeRef.current?.dispose();
          runtimeRef.current = null;
          setRuntimeError(t("sphere.webglLost"));
        },
        onNodeActivate: (node) => {
          const action = graphNodePrimaryAction(node);
          if (action?.type === "file") openFileRef.current(action.path);
          if (action?.type === "tagSearch") openTagSearchRef.current(action.tag);
        },
        onNodeFocus: (node) => setPinnedNodeId((current) => current === node.id ? null : node.id),
        onNodeHover: (node) => setHoveredNodeId(node?.id ? String(node.id) : null)
      });
      runtimeRef.current = runtime;
      runtime.setData(dataRef.current, themeRef.current);
    } catch {
      host.replaceChildren();
      setRuntimeError(t("sphere.unavailable"));
    }

    return () => {
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
    };
  }, [openFileRef, openTagSearchRef, t]);

  useEffect(() => {
    runtimeRef.current?.setData(sphereData, theme);
  }, [sphereData, theme]);

  useEffect(() => {
    runtimeRef.current?.setFocus(focusId);
  }, [focusId]);

  return (
    <div className="sphere-view-shell">
      <div className="sphere-view-canvas" ref={hostRef} />
      <div className="sphere-view-meta">
        <span className="sphere-view-badge">{t("sphere.experimental")}</span>
        <span>{t("graph.nodeCount", { count: filteredGraph.nodes.length })}</span>
        <span>{t("sphere.instructions")}</span>
      </div>
      {focusedNode ? <div className="sphere-view-focus">{focusedNode.label}</div> : null}
      {graphState.loading ? <div className="graph-view-status">{t("sphere.loading")}</div> : null}
      {graphState.error ? (
        <div className="graph-view-status graph-view-status--error">{graphState.error}</div>
      ) : null}
      {!graphState.loading && !graphState.error && filteredGraph.nodes.length === 0 ? (
        <div className="graph-view-status">{t("sphere.empty")}</div>
      ) : null}
      {runtimeError ? (
        <div className="graph-view-status graph-view-status--error">{runtimeError}</div>
      ) : null}
    </div>
  );
}
