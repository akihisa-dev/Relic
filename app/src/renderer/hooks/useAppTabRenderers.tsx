import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  EditorSettings,
  FeatureToggles,
  UpdateGanttChartEntryInput,
  UserDefinedField,
  WorkspaceGanttChart,
  WorkspaceState
} from "../../shared/ipc";
import { GanttChartView } from "../components/ChronicleSidebar";
import { DashboardPanel } from "../components/DashboardPanel";
import { FrontmatterSidebar } from "../components/FrontmatterSidebar";
import { GraphPanel } from "../components/GraphSidebar";
import { SettingsSidebar } from "../components/SettingsSidebar";
import { ToolsSidebar } from "../components/ToolsSidebar";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  activeFilePathForGraph: string | null;
  appInfo: AppInfo | null;
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  ganttCharts: WorkspaceGanttChart[];
  handleOpenFile: (path: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleUpdateGanttChartEntry: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  activeFilePathForGraph,
  appInfo,
  editorSettings,
  featureToggles,
  ganttCharts,
  handleOpenFile,
  handleSaveFeatureToggles,
  handleSaveSettings,
  handleSaveUserDefinedFields,
  handleUpdateGanttChartEntry,
  userDefinedFields,
  workspaceState
}: UseAppTabRenderersInput): {
  renderGanttChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderGanttChartTab = useCallback((chartId: string): ReactNode => (
    <GanttChartView
      chart={chartId === "charts" ? null : ganttCharts.find((chart) => chart.id === chartId) ?? null}
      charts={chartId === "charts" ? ganttCharts : undefined}
      onOpenFile={handleOpenFile}
      onUpdateEntry={handleUpdateGanttChartEntry}
    />
  ), [ganttCharts, handleOpenFile, handleUpdateGanttChartEntry]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "dashboard") {
      return (
        <DashboardPanel
          fileTree={workspaceState?.fileTree ?? []}
          onOpenFile={handleOpenFile}
          userDefinedFields={userDefinedFields}
          workspaceId={workspaceState?.activeWorkspace?.id ?? null}
        />
      );
    }

    if (panel === "tools") {
      return <ToolsSidebar workspacePath={workspaceState?.activeWorkspace?.path ?? null} />;
    }

    if (panel === "frontmatter") {
      return (
        <FrontmatterSidebar
          onUserDefinedFieldsSave={handleSaveUserDefinedFields}
          userDefinedFields={userDefinedFields}
        />
      );
    }

    if (panel === "graph") {
      return (
        <GraphPanel
          activeFilePath={activeFilePathForGraph}
          workspaceId={workspaceState?.activeWorkspace?.id ?? null}
        />
      );
    }

    return (
      <SettingsSidebar
        appInfo={appInfo}
        featureToggles={featureToggles}
        onFeatureTogglesSave={handleSaveFeatureToggles}
        onSave={handleSaveSettings}
        settings={editorSettings}
      />
    );
  }, [
    activeFilePathForGraph,
    appInfo,
    editorSettings,
    featureToggles,
    handleOpenFile,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields,
    workspaceState
  ]);

  return {
    renderGanttChartTab,
    renderPanelTab
  };
}
