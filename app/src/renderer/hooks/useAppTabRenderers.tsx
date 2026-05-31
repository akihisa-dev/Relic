import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  AISettingsState,
  AIProvider,
  ChronicleCalendarSettings,
  EditorSettings,
  FeatureToggles,
  OpenAIWorkspaceModel,
  UpdateChartEntryInput,
  UserDefinedField,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { ChartView } from "../components/ChartPanel";
import { ChronicleSettingsPanel } from "../components/ChronicleSettingsPanel";
import { FrontmatterPanel } from "../components/FrontmatterPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { ToolsPanel } from "../components/ToolsPanel";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  aiSettings: AISettingsState | null;
  aiSettingsStatus: string | null;
  chronicleCalendars: ChronicleCalendarSettings[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  charts: WorkspaceChart[];
  handleOpenFile: (path: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleDeleteOpenAIAPIKey: () => void;
  handleSaveChronicleCalendars: (calendars: ChronicleCalendarSettings[]) => void;
  handleSaveAIModel: (model: OpenAIWorkspaceModel) => void;
  handleSaveAIProvider: (provider: AIProvider) => void;
  handleSaveOpenAIAPIKey: (apiKey: string) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleTestOpenAIAPIKey: () => void;
  handleUpdateChartEntry: (input: UpdateChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  appInfo,
  aiSettings,
  aiSettingsStatus,
  chronicleCalendars,
  editorSettings,
  featureToggles,
  charts,
  handleOpenFile,
  handleSaveFeatureToggles,
  handleDeleteOpenAIAPIKey,
  handleSaveChronicleCalendars,
  handleSaveAIModel,
  handleSaveAIProvider,
  handleSaveOpenAIAPIKey,
  handleSaveSettings,
  handleSaveUserDefinedFields,
  handleTestOpenAIAPIKey,
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
        aiSettings={aiSettings}
        aiSettingsStatus={aiSettingsStatus}
        featureToggles={featureToggles}
        onDeleteOpenAIAPIKey={handleDeleteOpenAIAPIKey}
        onFeatureTogglesSave={handleSaveFeatureToggles}
        onSaveAIModel={handleSaveAIModel}
        onSaveAIProvider={handleSaveAIProvider}
        onSaveOpenAIAPIKey={handleSaveOpenAIAPIKey}
        onSave={handleSaveSettings}
        onTestOpenAIAPIKey={handleTestOpenAIAPIKey}
        settings={editorSettings}
      />
    );
  }, [
    appInfo,
    aiSettings,
    aiSettingsStatus,
    chronicleCalendars,
    editorSettings,
    featureToggles,
    handleOpenFile,
    handleDeleteOpenAIAPIKey,
    handleSaveFeatureToggles,
    handleSaveChronicleCalendars,
    handleSaveAIModel,
    handleSaveAIProvider,
    handleSaveOpenAIAPIKey,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    handleTestOpenAIAPIKey,
    userDefinedFields,
    workspaceState
  ]);

  return {
    renderChartTab,
    renderPanelTab
  };
}
