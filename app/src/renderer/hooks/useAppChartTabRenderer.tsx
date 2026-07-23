import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { ChronicleCalendarSettings } from "../../shared/chronicleCalendar";
import type { FeatureToggles, FrontmatterCategoryChoice, WorkspaceChart } from "../../shared/ipc";
import { preloadWorkspaceGraph } from "../graph/workspaceGraphLoader";
import { useEditorStore, type PaneId } from "../store/editorStore";
import {
  LazyCardView,
  LazyChartView,
  LazyBubbleView,
  LazySphereView,
  LazyTableView,
  LazyTabFallback
} from "./appTabLazyViews";

interface ChroniclePaneViewState {
  hiddenCategoryKeys: string[];
  railCollapsed: boolean;
  workspaceId: string;
}

interface UseAppChartTabRendererInput {
  calendarSettings: ChronicleCalendarSettings;
  categoryChoices: FrontmatterCategoryChoice[];
  charts: WorkspaceChart[];
  currentFilePath: string | null;
  featureToggles: FeatureToggles;
  onCalendarSettingsSave: (settings: ChronicleCalendarSettings) => void;
  onCategoryChoicesSave: (choices: FrontmatterCategoryChoice[]) => void;
  onOpenFile: (path: string) => void;
  onOpenTagSearch: (tag: string) => void;
  workspaceDataRevision: number;
  workspaceId: string;
}

const defaultChroniclePaneViewState = (workspaceId: string): ChroniclePaneViewState => ({
  hiddenCategoryKeys: [],
  railCollapsed: false,
  workspaceId
});

export function useAppChartTabRenderer({
  calendarSettings,
  categoryChoices,
  charts,
  currentFilePath,
  featureToggles,
  onCalendarSettingsSave,
  onCategoryChoicesSave,
  onOpenFile,
  onOpenTagSearch,
  workspaceDataRevision,
  workspaceId
}: UseAppChartTabRendererInput): (chartId: string, pane?: PaneId) => ReactNode {
  const leftHasChronicle = useEditorStore((state) => state.leftPane.tabIds.includes("chart-chronicle"));
  const rightHasChronicle = useEditorStore((state) => state.rightPane.tabIds.includes("chart-chronicle"));
  const [chroniclePaneViewStates, setChroniclePaneViewStates] = useState<Record<PaneId, ChroniclePaneViewState>>({
    left: defaultChroniclePaneViewState(workspaceId),
    right: defaultChroniclePaneViewState(workspaceId)
  });
  const [cardSelection, setCardSelection] = useState<{ path: string; workspaceId: string } | null>(null);
  const currentFileRef = useRef<{ path: string; workspaceId: string } | null>(null);
  if (currentFilePath) currentFileRef.current = { path: currentFilePath, workspaceId };
  const selectedCardPath = cardSelection?.workspaceId === workspaceId ? cardSelection.path : null;
  const currentCardPath = currentFileRef.current?.workspaceId === workspaceId
    ? currentFileRef.current.path
    : null;

  const handleSelectCard = useCallback((path: string): void => {
    setCardSelection({ path, workspaceId });
  }, [workspaceId]);
  const handleOpenCardFile = useCallback((path: string): void => {
    setCardSelection({ path, workspaceId });
    onOpenFile(path);
  }, [onOpenFile, workspaceId]);

  useEffect(() => {
    if (!featureToggles.sphere || workspaceId === "none") return;
    const timer = window.setTimeout(() => {
      void import("../components/SphereView");
      preloadWorkspaceGraph({ revision: workspaceDataRevision, workspaceId });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [featureToggles.sphere, workspaceDataRevision, workspaceId]);

  useEffect(() => {
    setChroniclePaneViewStates((current) => resetClosedChroniclePaneStates(
      current,
      { left: leftHasChronicle, right: rightHasChronicle },
      workspaceId
    ));
  }, [leftHasChronicle, rightHasChronicle, workspaceId]);

  return useCallback((chartId: string, pane: PaneId = "left"): ReactNode => {
    if (chartId === "cards") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyCardView
            currentPath={currentCardPath}
            onOpenFile={handleOpenCardFile}
            onSelectPath={handleSelectCard}
            refreshRevision={workspaceDataRevision}
            selectedPath={selectedCardPath}
            workspaceId={workspaceId}
          />
        </Suspense>
      );
    }
    if (chartId === "graph" || chartId === "sphere") {
      const View = chartId === "graph" ? LazyBubbleView : LazySphereView;
      return (
        <Suspense fallback={<LazyTabFallback visualization />}>
          <View
            onOpenFile={onOpenFile}
            onOpenTagSearch={onOpenTagSearch}
            refreshRevision={workspaceDataRevision}
            workspaceCacheKey={workspaceId}
          />
        </Suspense>
      );
    }
    if (chartId === "table") {
      return (
        <Suspense fallback={<LazyTabFallback />}>
          <LazyTableView
            categoryChoices={categoryChoices}
            onCategoryChoicesSave={onCategoryChoicesSave}
            onOpenFile={onOpenFile}
            refreshRevision={workspaceDataRevision}
            workspaceId={workspaceId}
          />
        </Suspense>
      );
    }

    const paneViewState = chroniclePaneViewStates[pane].workspaceId === workspaceId
      ? chroniclePaneViewStates[pane]
      : defaultChroniclePaneViewState(workspaceId);
    const updatePaneViewState = (patch: Partial<ChroniclePaneViewState>): void => {
      setChroniclePaneViewStates((current) => ({
        ...current,
        [pane]: {
          ...(current[pane].workspaceId === workspaceId
            ? current[pane]
            : defaultChroniclePaneViewState(workspaceId)),
          ...patch
        }
      }));
    };
    return (
      <Suspense fallback={<LazyTabFallback />}>
        <LazyChartView
          calendarSettings={calendarSettings}
          categoryChoices={categoryChoices}
          chart={chartId === "charts" ? null : charts.find((chart) => chart.id === chartId) ?? null}
          charts={chartId === "charts" ? charts : undefined}
          hiddenCategoryKeys={paneViewState.hiddenCategoryKeys}
          onCalendarSettingsSave={onCalendarSettingsSave}
          onHiddenCategoryKeysChange={(hiddenCategoryKeys: string[]) => updatePaneViewState({ hiddenCategoryKeys })}
          onOpenFile={onOpenFile}
          onRailCollapsedChange={(railCollapsed: boolean) => updatePaneViewState({ railCollapsed })}
          railCollapsed={paneViewState.railCollapsed}
        />
      </Suspense>
    );
  }, [calendarSettings, categoryChoices, charts, chroniclePaneViewStates, currentCardPath, handleOpenCardFile, handleSelectCard, onCalendarSettingsSave, onCategoryChoicesSave, onOpenFile, onOpenTagSearch, selectedCardPath, workspaceDataRevision, workspaceId]);
}

function resetClosedChroniclePaneStates(
  current: Record<PaneId, ChroniclePaneViewState>,
  hasChronicle: Record<PaneId, boolean>,
  workspaceId: string
): Record<PaneId, ChroniclePaneViewState> {
  const next = { ...current };
  let changed = false;
  for (const pane of ["left", "right"] as const) {
    if (hasChronicle[pane] && current[pane].workspaceId === workspaceId) continue;
    const reset = defaultChroniclePaneViewState(workspaceId);
    if (
      current[pane].workspaceId !== reset.workspaceId ||
      current[pane].hiddenCategoryKeys.length > 0 ||
      current[pane].railCollapsed
    ) {
      next[pane] = reset;
      changed = true;
    }
  }
  return changed ? next : current;
}
