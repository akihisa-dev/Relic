import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  ChronicleCalendarSettings,
  EditorSettings,
  FeatureToggles,
  UpdateChartEntryInput,
  UserDefinedField,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { ChartView } from "../components/ChartPanel";
import { ChronicleSettingsPanel } from "../components/ChronicleSettingsPanel";
import { FrontmatterPanel } from "../components/FrontmatterPanel";
import { MermaidEditorPanel } from "../components/MermaidEditorPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { ToolsPanel } from "../components/ToolsPanel";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  chronicleCalendars: ChronicleCalendarSettings[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  charts: WorkspaceChart[];
  handleOpenFile: (path: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveChronicleCalendars: (calendars: ChronicleCalendarSettings[]) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleUpdateChartEntry: (input: UpdateChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  appInfo,
  chronicleCalendars,
  editorSettings,
  featureToggles,
  charts,
  handleOpenFile,
  handleSaveFeatureToggles,
  handleSaveChronicleCalendars,
  handleSaveSettings,
  handleSaveUserDefinedFields,
  handleUpdateChartEntry,
  userDefinedFields,
  workspaceState
}: UseAppTabRenderersInput): {
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderChartTab = useCallback((chartId: string): ReactNode => (
    <ChartView
      chart={chartId === "charts" ? null : charts.find((chart) => chart.id === chartId) ?? null}
      charts={chartId === "charts" ? charts : undefined}
      chronicleCalendars={chronicleCalendars}
      onOpenFile={handleOpenFile}
      onUpdateEntry={handleUpdateChartEntry}
    />
  ), [charts, chronicleCalendars, handleOpenFile, handleUpdateChartEntry]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "tools") {
      return <ToolsPanel workspacePath={workspaceState?.activeWorkspace?.path ?? null} />;
    }

    if (panel === "frontmatter") {
      return (
        <FrontmatterPanel
          onUserDefinedFieldsSave={handleSaveUserDefinedFields}
          userDefinedFields={userDefinedFields}
        />
      );
    }

    if (panel === "mermaidEditor") {
      return <MermaidEditorPanel />;
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
      <SettingsPanel
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
    renderChartTab,
    renderPanelTab
  };
}
