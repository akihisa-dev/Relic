import { useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  EditorSettings,
  FeatureToggles,
  FrontmatterCategoryChoice,
  WorkspaceState
} from "../../shared/ipc";
import { FrontmatterPanel } from "../components/FrontmatterPanel";
import { GraphView } from "../components/GraphView";
import { SettingsPanel } from "../components/SettingsPanel";
import { ToolsPanel } from "../components/ToolsPanel";
import type { PanelTabKind } from "../store/editorStore";

interface UseAppTabRenderersInput {
  appInfo: AppInfo | null;
  categoryChoices: FrontmatterCategoryChoice[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  handleOpenFile: (path: string) => void;
  handleOpenTagSearch: (tag: string) => void;
  handleSaveFeatureToggles: (toggles: FeatureToggles) => void;
  handleSaveCategoryChoices: (choices: FrontmatterCategoryChoice[]) => void;
  handleSaveSettings: (settings: EditorSettings) => void;
  workspaceState: WorkspaceState | null;
}

export function useAppTabRenderers({
  appInfo,
  categoryChoices,
  editorSettings,
  featureToggles,
  handleOpenFile,
  handleOpenTagSearch,
  handleSaveFeatureToggles,
  handleSaveCategoryChoices,
  handleSaveSettings,
  workspaceState
}: UseAppTabRenderersInput): {
  renderChartTab: (chartId: string) => ReactNode;
  renderPanelTab: (panel: PanelTabKind) => ReactNode;
} {
  const renderChartTab = useCallback((chartId: string): ReactNode => {
    if (chartId === "graph") {
      return <GraphView onOpenFile={handleOpenFile} onOpenTagSearch={handleOpenTagSearch} />;
    }

    return null;
  }, [handleOpenFile, handleOpenTagSearch]);

  const renderPanelTab = useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "tools") {
      return <ToolsPanel workspacePath={workspaceState?.activeWorkspace?.path ?? null} />;
    }

    if (panel === "frontmatter") {
      return (
        <FrontmatterPanel
          categoryChoices={categoryChoices}
          onCategoryChoicesSave={handleSaveCategoryChoices}
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
    editorSettings,
    featureToggles,
    handleOpenFile,
    handleSaveFeatureToggles,
    handleSaveCategoryChoices,
    handleSaveSettings,
    workspaceState
  ]);

  return {
    renderChartTab,
    renderPanelTab
  };
}
