import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import type { WorkspaceGraph } from "../../shared/ipc";
import { createSphereData, sphereNodeColors } from "../sphere/sphereModel";
import { createSphereRuntime, type SphereRuntime } from "../sphere/sphereRuntime";
import { deriveVisibleGraph } from "../graph/graphDisplayModel";
import { graphNodePrimaryAction } from "../graph/graphSearchModel";
import { defaultGraphDrawTheme, type GraphDrawTheme } from "../graph/graphTypes";
import { readGraphDrawTheme } from "../graph/graphViewRuntime";
import { useLatest } from "../hooks/useLatest";
import { useWorkspaceGraphState } from "../hooks/useWorkspaceGraphState";
import { useT } from "../i18n";

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
  sphereData: ReturnType<typeof createSphereData>;
  visibleGraph: ReturnType<typeof deriveVisibleGraph>;
} | null = null;

function sphereModelFor(
  graph: WorkspaceGraph | null,
  cacheKey: string
): Pick<NonNullable<typeof cachedSphereModel>, "sphereData" | "visibleGraph"> {
  if (!graph) {
    const visibleGraph = deriveVisibleGraph(null);
    return { sphereData: createSphereData(visibleGraph), visibleGraph };
  }
  if (
    cachedSphereModel?.cacheKey === cacheKey &&
    cachedSphereModel.graph === graph
  ) {
    return cachedSphereModel;
  }
  const visibleGraph = deriveVisibleGraph(graph);
  cachedSphereModel = {
    cacheKey,
    graph,
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
  const graphState = useWorkspaceGraphState({
    loadFailedMessage: t("sphere.loadFailed"),
    refreshRevision,
    workspaceCacheKey
  });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [theme, setTheme] = useState<GraphDrawTheme>(defaultGraphDrawTheme);
  const sphereModel = useMemo(
    () => sphereModelFor(
      graphState.graph,
      `${workspaceCacheKey}:${refreshRevision}`
    ),
    [graphState.graph, refreshRevision, workspaceCacheKey]
  );
  const { sphereData, visibleGraph: filteredGraph } = sphereModel;
  const nodeColors = useMemo(
    () => sphereNodeColors(filteredGraph, theme),
    [filteredGraph, theme]
  );
  const focusId = selectedNodeId ?? hoveredNodeId;
  const focusedNode = focusId
    ? filteredGraph.nodes.find((node) => node.id === focusId) ?? null
    : null;
  const canResetView = filteredGraph.nodes.length > 0
    && !graphState.loading
    && !graphState.error
    && !runtimeError;

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
    const host = hostRef.current;
    if (!host) return;
    const shell = host.parentElement;

    try {
      const runtime = acquireSphereRuntime(host, {
        canvasLabel: t("sphere.canvasLabel"),
        onBackgroundClick: () => {
          selectedNodeIdRef.current = null;
          setSelectedNodeId(null);
        },
        onContextLost: () => {
          runtimeRef.current?.dispose();
          runtimeRef.current = null;
          setRuntimeError(t("sphere.webglLost"));
        },
        onNodeClick: (node) => {
          if (selectedNodeIdRef.current !== node.id) {
            selectedNodeIdRef.current = node.id;
            setSelectedNodeId(node.id);
            return;
          }
          const action = graphNodePrimaryAction(node);
          if (action?.type === "file") openFileRef.current(action.path);
          if (action?.type === "tagSearch") openTagSearchRef.current(action.tag);
        },
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
    if (!selectedNodeId || filteredGraph.nodes.some((node) => node.id === selectedNodeId)) return;
    selectedNodeIdRef.current = null;
    setSelectedNodeId(null);
  }, [filteredGraph.nodes, selectedNodeId]);

  useEffect(() => {
    runtimeRef.current?.setTheme(theme, nodeColors);
  }, [nodeColors, theme]);

  useEffect(() => {
    runtimeRef.current?.setFocus(focusId);
  }, [focusId]);

  return (
    <div className="sphere-view-shell">
      <div
        className="sphere-view-canvas"
        onKeyDown={(event) => {
          if (!canResetView || event.key !== "0" || event.altKey || event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          runtimeRef.current?.resetView();
        }}
        ref={hostRef}
      />
      <div className="sphere-view-meta">
        <span>{t("graph.nodeCount", { count: filteredGraph.nodes.length })}</span>
        <span>{t("sphere.instructions")}</span>
      </div>
      <button
        aria-label={t("sphere.resetView")}
        className="sphere-view-reset"
        disabled={!canResetView}
        onClick={() => runtimeRef.current?.resetView()}
        type="button"
      >
        <SphereResetIcon />
        <span className="sphere-view-reset-label">{t("sphere.resetView")}</span>
      </button>
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

function SphereResetIcon(): ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M3 12a9 9 0 1 0 3-6.708" />
      <path d="M3 3v6h6" />
    </svg>
  );
}
