import { Suspense, useCallback } from "react";
import type { ReactNode } from "react";

import type {
  AppInfo,
  EditorSettings,
  FeatureToggles,
  FrontmatterCategoryChoice
} from "../../shared/ipc";
import type { PanelTabKind } from "../store/editorStore";
import { LazyFrontmatterPanel, LazySettingsPanel, LazyTabFallback } from "./appTabLazyViews";

interface UseAppPanelTabRendererInput {
  appInfo: AppInfo | null;
  categoryChoices: FrontmatterCategoryChoice[];
  editorSettings: EditorSettings;
  featureToggles: FeatureToggles;
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
  onFeatureTogglesSave: (toggles: FeatureToggles) => void;
  onOpenFile: (path: string) => void;
  onSettingsSave: (settings: EditorSettings) => void;
  workspaceDataRevision: number;
  workspaceId: string;
}

export function useAppPanelTabRenderer({
  appInfo,
  categoryChoices,
  editorSettings,
  featureToggles,
  onCategoryChoicesSave,
  onFeatureTogglesSave,
  onOpenFile,
  onSettingsSave,
  workspaceDataRevision,
  workspaceId
}: UseAppPanelTabRendererInput): (panel: PanelTabKind) => ReactNode {
  return useCallback((panel: PanelTabKind): ReactNode => {
    if (panel === "frontmatter") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyFrontmatterPanel
            categoryChoices={categoryChoices}
            onCategoryChoicesSave={onCategoryChoicesSave}
            onOpenFile={onOpenFile}
            refreshRevision={workspaceDataRevision}
            workspaceId={workspaceId}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<LazyTabFallback />}>
        <LazySettingsPanel
          appInfo={appInfo}
          featureToggles={featureToggles}
          onFeatureTogglesSave={onFeatureTogglesSave}
          onSave={onSettingsSave}
          settings={editorSettings}
        />
      </Suspense>
    );
  }, [appInfo, categoryChoices, editorSettings, featureToggles, onCategoryChoicesSave, onFeatureTogglesSave, onOpenFile, onSettingsSave, workspaceDataRevision, workspaceId]);
}
