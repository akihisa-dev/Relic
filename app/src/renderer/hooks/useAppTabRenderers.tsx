import type { ReactNode } from "react";

import type {
  AppInfo,
  EditorSettings,
  FeatureToggles,
  FrontmatterCategoryChoice,
  WorkspaceChart,
  WorkspaceState
} from "../../shared/ipc";
import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import type { PaneId, PanelTabKind } from "../store/editorStore";
import { useAppChartTabRenderer } from "./useAppChartTabRenderer";
import { useAppPanelTabRenderer } from "./useAppPanelTabRenderer";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  categoryChoices: FrontmatterCategoryChoice[];
  calendarSettings: ChronicleCalendarSettings;
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  charts: WorkspaceChart[];
  currentFilePath: string | null;
  handleOpenFile: (path: string) => void;
  handleOpenTagSearch: (tag: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveCategoryChoices: (choices: FrontmatterCategoryChoice[]) => void;
  handleSaveCalendarSettings: (settings: ChronicleCalendarSettings) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  workspaceDataRevision: number;
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers(input: UseAppTabRenderersInput): {
  renderChartTab: (chartId: string, pane?: PaneId) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const workspaceId = input.workspaceState?.activeWorkspace?.id ?? "none";
  const renderChartTab = useAppChartTabRenderer({
    calendarSettings: input.calendarSettings,
    categoryChoices: input.categoryChoices,
    charts: input.charts,
    currentFilePath: input.currentFilePath,
    featureToggles: input.featureToggles,
    onCalendarSettingsSave: input.handleSaveCalendarSettings,
    onCategoryChoicesSave: input.handleSaveCategoryChoices,
    onOpenFile: input.handleOpenFile,
    onOpenTagSearch: input.handleOpenTagSearch,
    workspaceDataRevision: input.workspaceDataRevision,
    workspaceId
  });
  const renderPanelTab = useAppPanelTabRenderer({
    appInfo: input.appInfo,
    categoryChoices: input.categoryChoices,
    editorSettings: input.editorSettings,
    featureToggles: input.featureToggles,
    onCategoryChoicesSave: input.handleSaveCategoryChoices,
    onFeatureTogglesSave: input.handleSaveFeatureToggles,
    onOpenFile: input.handleOpenFile,
    onSettingsSave: input.handleSaveSettings,
    workspaceDataRevision: input.workspaceDataRevision,
    workspaceId
  });

  return { renderChartTab, renderPanelTab };
}
