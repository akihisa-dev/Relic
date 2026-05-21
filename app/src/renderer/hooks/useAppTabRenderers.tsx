import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  EditorSettings,
  FeatureToggles,
  UpdateTimelineChartEntryInput,
  UserDefinedField,
  CardbookTimelineChart,
  CardbookState
} from "../../shared/ipc";
import { CalendarSettingsSidebar } from "../components/CalendarSettingsSidebar";
import { TimelineView } from "../components/TimelineSidebar";
import { FrontmatterSidebar } from "../components/FrontmatterSidebar";
import { SettingsSidebar } from "../components/SettingsSidebar";
import { ToolsSidebar } from "../components/ToolsSidebar";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  timelineCharts: CardbookTimelineChart[];
  handleOpenCard: (path: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  handleSaveUserDefinedFields: (fields: UserDefinedField[]) => void;
  handleUpdateTimelineEntry: (input: UpdateTimelineChartEntryInput) => Promise<void> | void;
  userDefinedFields: UserDefinedField[];
  cardbookState: CardbookState | null;
}

export function useAppTabRenderers({
  appInfo,
  editorSettings,
  featureToggles,
  timelineCharts,
  handleOpenCard,
  handleSaveFeatureToggles,
  handleSaveSettings,
  handleSaveUserDefinedFields,
  handleUpdateTimelineEntry,
  userDefinedFields,
  cardbookState
}: UseAppTabRenderersInput): {
  renderTimelineTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderTimelineTab = useCallback((chartId: string): ReactNode => (
    <TimelineView
      chart={chartId === "charts" ? null : timelineCharts.find((chart) => chart.id === chartId) ?? null}
      charts={chartId === "charts" ? timelineCharts : undefined}
      onOpenCard={handleOpenCard}
      onUpdateEntry={handleUpdateTimelineEntry}
    />
  ), [timelineCharts, handleOpenCard, handleUpdateTimelineEntry]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "tools") {
      return <ToolsSidebar cardbookPath={cardbookState?.activeCardbook?.path ?? null} />;
    }

    if (panel === "frontmatter") {
      return (
        <FrontmatterSidebar
          onUserDefinedFieldsSave={handleSaveUserDefinedFields}
          userDefinedFields={userDefinedFields}
        />
      );
    }

    if (panel === "calendar-settings") {
      return <CalendarSettingsSidebar />;
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
    handleOpenCard,
    handleSaveFeatureToggles,
    handleSaveSettings,
    handleSaveUserDefinedFields,
    userDefinedFields,
    cardbookState
  ]);

  return {
    renderTimelineTab,
    renderPanelTab
  };
}
