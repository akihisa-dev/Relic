import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  ChronicleCalendarSettings,
  EditorSettings,
  FeatureToggles,
  UpdateGanttChartEntryInput,
  UserDefinedField,
  WorkspaceGanttChart,
  WorkspaceState
} from "../../shared/ipc";
import { GanttChartView } from "../components/ChronicleSidebar";
import { ChronicleSettingsPanel } from "../components/ChronicleSettingsPanel";
import { FrontmatterSidebar } from "../components/FrontmatterSidebar";
import { SettingsSidebar } from "../components/SettingsSidebar";
import { ToolsSidebar } from "../components/ToolsSidebar";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  chronicleCalendars: ChronicleCalendarSettings[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  ganttCharts: WorkspaceGanttChart[];
  handleOpenFile: (path: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveChronicleCalendars: (calendars: ChronicleCalendarSettings[]) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleUpdateGanttChartEntry: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  appInfo,
  chronicleCalendars,
  editorSettings,
  featureToggles,
  ganttCharts,
  handleOpenFile,
  handleSaveFeatureToggles,
  handleSaveChronicleCalendars,
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

    if (panel === "chronicleSettings") {
      return (
        <ChronicleSettingsPanel
          calendars={chronicleCalendars}
          onSave={handleSaveChronicleCalendars}
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
    appInfo,
    chronicleCalendars,
    editorSettings,
    featureToggles,
    handleOpenFile,
    handleSaveFeatureToggles,
    handleSaveChronicleCalendars,
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
