import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import type { WorkspaceGraph } from "../../shared/ipc";
import { loadSphereWorkspaceGraph } from "../sphere/sphereGraphLoader";
import { createSphereData, sphereNodeColors } from "../sphere/sphereModel";
import { createSphereRuntime, type SphereRuntime } from "../sphere/sphereRuntime";
import { deriveVisibleGraph } from "../graph/graphDisplayModel";
import { graphNodePrimaryAction } from "../graph/graphSearchModel";
import { defaultGraphDrawTheme, type GraphDrawTheme, type GraphOptions } from "../graph/graphTypes";
import { loadGraphColorGroups, loadGraphOptions, readGraphDrawTheme } from "../graph/graphViewRuntime";
import { useLatest } from "../hooks/useLatest";
import { useT } from "../i18n";
import { relicClient } from "../relicClient";

interface SphereViewProps {
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  refreshRevision?: number;
  workspaceCacheKey?: string;
}

const parkedRuntimeLifetimeMs = 2_000;
let parkedRuntime: {
  disposeTimer: number;
  runtime: SphereRuntime;
} | null = null;

function acquireSphereRuntime(
  host: HTMLElement,
  callbacks: Parameters<typeof createSphereRuntime>[1]
): SphereRuntime {
  if (!parkedRuntime) return createSphereRuntime(host, callbacks);
  window.clearTimeout(parkedRuntime.disposeTimer);
  const runtime = parkedRuntime.runtime;
  parkedRuntime = null;
  runtime.setCallbacks(callbacks);
  runtime.attach(host);
  return runtime;
}

function releaseSphereRuntime(runtime: SphereRuntime): void {
  runtime.suspend();
  if (parkedRuntime) {
    runtime.dispose();
    return;
  }
  const disposeTimer = window.setTimeout(() => {
    if (parkedRuntime?.runtime !== runtime) return;
    parkedRuntime = null;
    runtime.dispose();
  }, parkedRuntimeLifetimeMs);
  parkedRuntime = { disposeTimer, runtime };
}

export function disposeParkedSphereRuntime(): void {
  if (!parkedRuntime) return;
  window.clearTimeout(parkedRuntime.disposeTimer);
  parkedRuntime.runtime.dispose();
  parkedRuntime = null;
}

let cachedSphereModel: {
  cacheKey: string;
  graph: WorkspaceGraph;
  optionsSignature: string;
  sphereData: ReturnType<typeof createSphereData>;
  visibleGraph: ReturnType<typeof deriveVisibleGraph>;
} | null = null;

function sphereModelFor(
  graph: WorkspaceGraph | null,
  options: GraphOptions,
  cacheKey: string
): Pick<NonNullable<typeof cachedSphereModel>, "sphereData" | "visibleGraph"> {
  if (!graph) {
    const visibleGraph = deriveVisibleGraph(null, options);
    return { sphereData: createSphereData(visibleGraph), visibleGraph };
  }
  const optionsSignature = JSON.stringify(options);
  if (
    cachedSphereModel?.cacheKey === cacheKey &&
    cachedSphereModel.graph === graph &&
    cachedSphereModel.optionsSignature === optionsSignature
  ) {
    return cachedSphereModel;
  }
  const visibleGraph = deriveVisibleGraph(graph, options);
  cachedSphereModel = {
    cacheKey,
    graph,
    optionsSignature,
    sphereData: createSphereData(visibleGraph),
    visibleGraph
  };
  return cachedSphereModel;
}

export function SphereView({
  onOpenFile,
  onOpenTagSearch,
  refreshRevision = 0,
  workspaceCacheKey = "current"
}: SphereViewProps): ReactElement {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SphereRuntime | null>(null);
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
  const sphereModel = useMemo(
    () => sphereModelFor(
      graphState.graph,
      options,
      `${workspaceCacheKey}:${refreshRevision}`
    ),
    [graphState.graph, options, refreshRevision, workspaceCacheKey]
  );
  const { sphereData, visibleGraph: filteredGraph } = sphereModel;
  const nodeColors = useMemo(
    () => sphereNodeColors(filteredGraph, colorGroups, theme),
    [colorGroups, filteredGraph, theme]
  );
  const focusId = pinnedNodeId ?? hoveredNodeId;
  const focusedNode = focusId
    ? filteredGraph.nodes.find((node) => node.id === focusId) ?? null
    : null;

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

    void loadSphereWorkspaceGraph(`${workspaceCacheKey}:${refreshRevision}`).then((result) => {
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
  }, [refreshRevision, t, workspaceCacheKey]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shell = host.parentElement;

    try {
      const runtime = acquireSphereRuntime(host, {
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
    } catch {
      host.replaceChildren();
      setRuntimeError(t("sphere.unavailable"));
    }

    return () => {
      const runtime = runtimeRef.current;
      if (runtime) {
        releaseSphereRuntime(runtime);
        runtimeRef.current = null;
      }
      queueMicrotask(() => {
        if (shell && !shell.isConnected) shell.replaceChildren();
      });
    };
  }, [openFileRef, openTagSearchRef, t]);

  useEffect(() => {
    runtimeRef.current?.setData(sphereData);
  }, [sphereData]);

  useEffect(() => {
    runtimeRef.current?.setTheme(theme, nodeColors);
  }, [nodeColors, theme]);

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
