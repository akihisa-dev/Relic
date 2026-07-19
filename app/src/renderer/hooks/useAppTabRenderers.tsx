import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type {
  AppInfo,
  EditorSettings,
  FeatureToggles,
  FrontmatterCategoryChoice,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { useT } from "../i18n";
import { preloadWorkspaceGraph } from "../graph/workspaceGraphLoader";
import { useEditorStore, type PaneId, type PanelTabKind } from "../store/editorStore";

const LazyChartView = lazy(async () => ({
  default: (await import("../components/ChartPanel")).ChartView
}));
const LazyCardView = lazy(async () => ({
  default: (await import("../components/CardView")).CardView
}));
const LazyGraphView = lazy(async () => ({
  default: (await import("../components/GraphView")).GraphView
}));
const LazySphereView = lazy(async () => ({
  default: (await import("../components/SphereView")).SphereView
}));
const LazyTableView = lazy(async () => ({
  default: (await import("../components/TableView")).TableView
}));
const LazyFrontmatterPanel = lazy(async () => ({
  default: (await import("../components/FrontmatterPanel")).FrontmatterPanel
}));
const LazySettingsPanel = lazy(async () => ({
  default: (await import("../components/SettingsPanel")).SettingsPanel
}));

function LazyTabFallback({ graph = false }: { graph?: boolean }): ReactElement {
  const t = useT();
  return (
    <div className={graph ? "graph-view-status" : "list-loading-note"}>
      {t(graph ? "graph.loading" : "common.loading")}
    </div>
  );
}

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  categoryChoices: FrontmatterCategoryChoice[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  charts: WorkspaceChart[];
  currentFilePath: string | null;
  handleOpenFile: (path: string) => void;
  handleOpenTagSearch: (tag: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveCategoryChoices: (choices: FrontmatterCategoryChoice[]) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  workspaceDataRevision: number;
  workspaceState: WorkspaceState | null;
}

interface ChroniclePaneViewState {
  hiddenCategoryKeys: string[];
  railCollapsed: boolean;
  workspaceId: string;
}

const defaultChroniclePaneViewState = (workspaceId: string): ChroniclePaneViewState => ({
  hiddenCategoryKeys: [],
  railCollapsed: false,
  workspaceId
});

export function useAppTabRenderers({
  appInfo,
  categoryChoices,
  editorSettings,
  featureToggles,
  charts,
  currentFilePath,
  handleOpenFile,
  handleOpenTagSearch,
  handleSaveFeatureToggles,
  handleSaveCategoryChoices,
  handleSaveSettings,
  workspaceDataRevision,
  workspaceState
}: UseAppTabRenderersInput): {
  renderChartTab: (chartId: string, pane?: PaneId) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const workspaceCacheKey = workspaceState?.activeWorkspace?.id ?? "none";
  const leftHasChronicle = useEditorStore((state) => state.leftPane.tabIds.includes("chart-chronicle"));
  const rightHasChronicle = useEditorStore((state) => state.rightPane.tabIds.includes("chart-chronicle"));
  const [chroniclePaneViewStates, setChroniclePaneViewStates] = useState<Record<PaneId, ChroniclePaneViewState>>({
    left: defaultChroniclePaneViewState(workspaceCacheKey),
    right: defaultChroniclePaneViewState(workspaceCacheKey)
  });
  const [cardSelection, setCardSelection] = useState<{ path: string; workspaceId: string } | null>(null);
  const currentFileRef = useRef<{ path: string; workspaceId: string } | null>(null);
  if (currentFilePath) {
    currentFileRef.current = { path: currentFilePath, workspaceId: workspaceCacheKey };
  }
  const selectedCardPath = cardSelection?.workspaceId === workspaceCacheKey ? cardSelection.path : null;
  const currentCardPath = currentFileRef.current?.workspaceId === workspaceCacheKey
    ? currentFileRef.current.path
    : null;

  const handleSelectCard = useCallback((path: string): void => {
    setCardSelection({ path, workspaceId: workspaceCacheKey });
  }, [workspaceCacheKey]);

  const handleOpenCardFile = useCallback((path: string): void => {
    setCardSelection({ path, workspaceId: workspaceCacheKey });
    handleOpenFile(path);
  }, [handleOpenFile, workspaceCacheKey]);

  useEffect(() => {
    if (!featureToggles.sphere || workspaceCacheKey === "none") return;
    const timer = window.setTimeout(() => {
      void import("../components/SphereView");
      preloadWorkspaceGraph({
        revision: workspaceDataRevision,
        workspaceId: workspaceCacheKey
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [featureToggles.sphere, workspaceCacheKey, workspaceDataRevision]);

  useEffect(() => {
    setChroniclePaneViewStates((current) => {
      const next = { ...current };
      let changed = false;
      for (const [pane, hasChronicle] of [["left", leftHasChronicle], ["right", rightHasChronicle]] as const) {
        if (hasChronicle && current[pane].workspaceId === workspaceCacheKey) continue;
        const reset = defaultChroniclePaneViewState(workspaceCacheKey);
        if (
          current[pane].workspaceId !== reset.workspaceId ||
          current[pane].hiddenCategoryKeys.length > 0 ||
          current[pane].railCollapsed
        ) {
          next[pane] = reset;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [leftHasChronicle, rightHasChronicle, workspaceCacheKey]);

  const renderChartTab = useCallback((chartId: string, pane: PaneId = "left"): ReactNode => {
    if (chartId === "cards") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyCardView
            currentPath={currentCardPath}
            onOpenFile={handleOpenCardFile}
            onSelectPath={handleSelectCard}
            refreshRevision={workspaceDataRevision}
            selectedPath={selectedCardPath}
            workspaceId={workspaceCacheKey}
          />
        </Suspense>
      );
    }

    if (chartId === "graph") {
      return (
        <Suspense fallback={<LazyTabFallback graph />}>
          <LazyGraphView
            onOpenFile={handleOpenFile}
            onOpenTagSearch={handleOpenTagSearch}
            refreshRevision={workspaceDataRevision}
            workspaceCacheKey={workspaceCacheKey}
          />
        </Suspense>
      );
    }

    if (chartId === "table") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyTableView
            categoryChoices={categoryChoices}
            onCategoryChoicesSave={handleSaveCategoryChoices}
            onOpenFile={handleOpenFile}
            refreshRevision={workspaceDataRevision}
            workspaceId={workspaceCacheKey}
          />
        </Suspense>
      );
    }

    if (chartId === "sphere") {
      return (
        <Suspense fallback={<LazyTabFallback graph />}>
          <LazySphereView
            onOpenFile={handleOpenFile}
            onOpenTagSearch={handleOpenTagSearch}
            refreshRevision={workspaceDataRevision}
            workspaceCacheKey={workspaceCacheKey}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LazyTabFallback />}>
        <LazyChartView
          categoryChoices={categoryChoices}
          chart={chartId === "charts" ? null : charts.find((chart) => chart.id === chartId) ?? null}
          charts={chartId === "charts" ? charts : undefined}
          hiddenCategoryKeys={chroniclePaneViewStates[pane].workspaceId === workspaceCacheKey
            ? chroniclePaneViewStates[pane].hiddenCategoryKeys
            : []}
          onHiddenCategoryKeysChange={(hiddenCategoryKeys: string[]) => {
            setChroniclePaneViewStates((current) => ({
              ...current,
              [pane]: {
                ...(current[pane].workspaceId === workspaceCacheKey
                  ? current[pane]
                  : defaultChroniclePaneViewState(workspaceCacheKey)),
                hiddenCategoryKeys
              }
            }));
          }}
          onOpenFile={handleOpenFile}
          onRailCollapsedChange={(railCollapsed: boolean) => {
            setChroniclePaneViewStates((current) => ({
              ...current,
              [pane]: {
                ...(current[pane].workspaceId === workspaceCacheKey
                  ? current[pane]
                  : defaultChroniclePaneViewState(workspaceCacheKey)),
                railCollapsed
              }
            }));
          }}
          railCollapsed={chroniclePaneViewStates[pane].workspaceId === workspaceCacheKey
            ? chroniclePaneViewStates[pane].railCollapsed
            : false}
        />
      </Suspense>
    );
  }, [categoryChoices, charts, chroniclePaneViewStates, currentCardPath, handleOpenCardFile, handleOpenFile, handleOpenTagSearch, handleSaveCategoryChoices, handleSelectCard, selectedCardPath, workspaceCacheKey, workspaceDataRevision]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "frontmatter") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyFrontmatterPanel
            categoryChoices={categoryChoices}
            onCategoryChoicesSave={handleSaveCategoryChoices}
            onOpenFile={handleOpenFile}
            refreshRevision={workspaceDataRevision}
            workspaceId={workspaceCacheKey}
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LazyTabFallback />}>
        <LazySettingsPanel
          appInfo={appInfo}
          featureToggles={featureToggles}
          onFeatureTogglesSave={handleSaveFeatureToggles}
          onSave={handleSaveSettings}
          settings={editorSettings}
        />
      </Suspense>
    );
  }, [
    appInfo,
    categoryChoices,
    editorSettings,
    featureToggles,
    handleOpenFile,
    handleSaveFeatureToggles,
    handleSaveCategoryChoices,
    handleSaveSettings,
    workspaceCacheKey,
    workspaceDataRevision,
    workspaceState
  ]);

  return {
    renderChartTab,
    renderPanelTab
  };
}
