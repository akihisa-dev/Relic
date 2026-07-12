import { lazy, Suspense, useCallback } from "react";
import type { ReactElement, ReactNode } from "react";

import type {
  AppInfo,
  ChronicleCalendarSettings,
  EditorSettings,
  FeatureToggles,
  FrontmatterCategoryChoice,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { useT } from "../i18n";
import type { PanelTabKind } from "../store/editorStore";

const LazyChartView = lazy(async () => ({
  default: (await import("../components/ChartPanel")).ChartView
}));
const LazyGraphView = lazy(async () => ({
  default: (await import("../components/GraphView")).GraphView
}));
const LazyChronicleSettingsPanel = lazy(async () => ({
  default: (await import("../components/ChronicleSettingsPanel")).ChronicleSettingsPanel
}));
const LazyFrontmatterPanel = lazy(async () => ({
  default: (await import("../components/FrontmatterPanel")).FrontmatterPanel
}));
const LazySettingsPanel = lazy(async () => ({
  default: (await import("../components/SettingsPanel")).SettingsPanel
}));
const LazyToolsPanel = lazy(async () => ({
  default: (await import("../components/ToolsPanel")).ToolsPanel
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
  chronicleCalendars: ChronicleCalendarSettings[];
  categoryChoices: FrontmatterCategoryChoice[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  charts: WorkspaceChart[];
  handleOpenFile: (path: string) => void;
  handleOpenTagSearch: (tag: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveChronicleCalendars: (calendars: ChronicleCalendarSettings[]) => void;
  handleSaveCategoryChoices: (choices: FrontmatterCategoryChoice[]) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  appInfo,
  chronicleCalendars,
  categoryChoices,
  editorSettings,
  featureToggles,
  charts,
  handleOpenFile,
  handleOpenTagSearch,
  handleSaveFeatureToggles,
  handleSaveChronicleCalendars,
  handleSaveCategoryChoices,
  handleSaveSettings,
  workspaceState
}: UseAppTabRenderersInput): {
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderChartTab = useCallback((chartId: string): ReactNode => {
    if (chartId === "graph") {
      return (
        <Suspense fallback={<LazyTabFallback graph />}>
          <LazyGraphView onOpenFile={handleOpenFile} onOpenTagSearch={handleOpenTagSearch} />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<LazyTabFallback />}>
        <LazyChartView
          chart={chartId === "charts" ? null : charts.find((chart) => chart.id === chartId) ?? null}
          charts={chartId === "charts" ? charts : undefined}
          onOpenFile={handleOpenFile}
        />
      </Suspense>
    );
  }, [charts, handleOpenFile, handleOpenTagSearch]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "tools") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyToolsPanel workspacePath={workspaceState?.activeWorkspace?.path ?? null} />
        </Suspense>
      );
    }

    if (panel === "frontmatter") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyFrontmatterPanel
            categoryChoices={categoryChoices}
            onCategoryChoicesSave={handleSaveCategoryChoices}
          />
        </Suspense>
      );
    }

    if (panel === "chronicleSettings") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyChronicleSettingsPanel
            calendars={chronicleCalendars}
            onSave={handleSaveChronicleCalendars}
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
    chronicleCalendars,
    editorSettings,
    featureToggles,
    handleOpenFile,
    handleSaveFeatureToggles,
    handleSaveChronicleCalendars,
    handleSaveCategoryChoices,
    handleSaveSettings,
    workspaceState
  ]);

  return {
    renderChartTab,
    renderPanelTab
  };
}
