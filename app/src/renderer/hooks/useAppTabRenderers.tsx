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
import { ChronicleView } from "../components/ChronicleSidebar";
import { FrontmatterSidebar } from "../components/FrontmatterSidebar";
import { SettingsSidebar } from "../components/SettingsSidebar";
import { ToolsSidebar } from "../components/ToolsSidebar";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  chronicleCharts: WorkspaceGanttChart[];
  handleOpenFile: (path: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleUpdateChronicleEntry: (input: UpdateGanttChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  appInfo,
  editorSettings,
  featureToggles,
  chronicleCharts,
  handleOpenFile,
  handleSaveFeatureToggles,
  handleSaveSettings,
  handleSaveUserDefinedFields,
  handleUpdateChronicleEntry,
  userDefinedFields,
  workspaceState
}: UseAppTabRenderersInput): {
  renderChronicleTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderChronicleTab = useCallback((chartId: string): ReactNode => (
    <ChronicleView
      chart={chartId === "charts" ? null : chronicleCharts.find((chart) => chart.id === chartId) ?? null}
      charts={chartId === "charts" ? chronicleCharts : undefined}
      onOpenFile={handleOpenFile}
      onUpdateEntry={handleUpdateChronicleEntry}
    />
  ), [chronicleCharts, handleOpenFile, handleUpdateChronicleEntry]);

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
    renderChronicleTab,
    renderPanelTab
  };
}
