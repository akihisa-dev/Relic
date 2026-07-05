import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  ChronicleCalendarSettings,
  EditorSettings,
  FeatureToggles,
  FrontmatterCategoryChoice,
  UpdateChartEntryInput,
  UserDefinedField,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import { ChartView } from "../components/ChartPanel";
import { ChronicleSettingsPanel } from "../components/ChronicleSettingsPanel";
import { FrontmatterPanel } from "../components/FrontmatterPanel";
import { GraphView } from "../components/GraphView";
import { SettingsPanel } from "../components/SettingsPanel";
import { ToolsPanel } from "../components/ToolsPanel";
import type { PanelTabKind } from "../store/editorStore";

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
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleUpdateChartEntry: (input: UpdateChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
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
  handleSaveUserDefinedFields,
  userDefinedFields,
  workspaceState
}: UseAppTabRenderersInput): {
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderChartTab = useCallback((chartId: string): ReactNode => {
    if (chartId === "graph") {
      return <GraphView onOpenFile={handleOpenFile} onOpenTagSearch={handleOpenTagSearch} />;
    }

    return (
      <ChartView
        chart={chartId === "charts" ? null : charts.find((chart) => chart.id === chartId) ?? null}
        charts={chartId === "charts" ? charts : undefined}
        onOpenFile={handleOpenFile}
      />
    );
  }, [charts, handleOpenFile, handleOpenTagSearch]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "tools") {
      return <ToolsPanel workspacePath={workspaceState?.activeWorkspace?.path ?? null} />;
    }

    if (panel === "frontmatter") {
      return (
        <FrontmatterPanel
          categoryChoices={categoryChoices}
          onCategoryChoicesSave={handleSaveCategoryChoices}
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
        featureToggles={featureToggles}
        onFeatureTogglesSave={handleSaveFeatureToggles}
        onSave={handleSaveSettings}
        settings={editorSettings}
      />
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
    handleSaveUserDefinedFields,
    userDefinedFields,
    workspaceState
  ]);

  return {
    renderChartTab,
    renderPanelTab
  };
}
