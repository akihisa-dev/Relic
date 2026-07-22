import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";

import type { ChartEntry } from "../../shared/ipc";
import {
  defaultChronicleCalendarSettings,
  type ChronicleCalendarSettings
} from "../../shared/chronicleCalendar";
import {
  createChronicleCategoryOptions
} from "../chronicleCategoryModel";
import {
  chronicleEntryCategoryVisibilityKey,
  createChronicleCalendarHues,
  createChronicleCalendarTree
} from "../chronicleCalendarTreeModel";
import {
  CHRONICLE_INITIAL_PERIOD_SCALE,
  CHRONICLE_PERIOD_SCALES,
  createChronicleCanvasScene,
  type ChroniclePeriodScale
} from "../chronicleCanvasModel";
import { useChronicleCanvasRuntime } from "../hooks/useChronicleCanvasRuntime";
import { useT } from "../i18n";
import {
  ChronicleCalendarSettingsPanel,
  useChronicleCalendarSettingsPopover
} from "./ChronicleCalendarSettingsPanel";
import { ChronicleCalendarTreeRail } from "./ChronicleCalendarTreeRail";

interface ChronicleCanvasProps {
  calendarSettings?: ChronicleCalendarSettings;
  categoryChoices?: string[];
  entries: ChartEntry[];
  hiddenCategoryKeys?: string[];
  onOpenFile: (path: string) => void;
  onCalendarSettingsSave?: (settings: ChronicleCalendarSettings) => void;
  onHiddenCategoryKeysChange?: (keys: string[]) => void;
  onRailCollapsedChange?: (collapsed: boolean) => void;
  railCollapsed?: boolean;
}

const emptyCategoryChoices: string[] = [];
export function ChronicleCanvas({
  calendarSettings = defaultChronicleCalendarSettings,
  categoryChoices = emptyCategoryChoices,
  entries,
  hiddenCategoryKeys = emptyCategoryChoices,
  onOpenFile,
  onCalendarSettingsSave = () => undefined,
  onHiddenCategoryKeysChange = () => undefined,
  onRailCollapsedChange = () => undefined,
  railCollapsed = false
}: ChronicleCanvasProps): ReactElement {
  const t = useT();
  const calendarSettingsPopover = useChronicleCalendarSettingsPopover();
  const categoryOptions = useMemo(() => createChronicleCategoryOptions(
    entries,
    categoryChoices,
    t("chronicle.uncategorized")
  ), [categoryChoices, entries, t]);
  const categoryHues = useMemo(() => new Map(categoryOptions.flatMap((option) => (
    option.hue === null ? [] : [[option.key, option.hue] as const]
  ))), [categoryOptions]);
  const calendarHues = useMemo(() => createChronicleCalendarHues(calendarSettings), [calendarSettings]);
  const calendarTree = useMemo(() => createChronicleCalendarTree(
    entries,
    calendarSettings,
    categoryChoices,
    t("chronicle.uncategorized"),
    calendarHues,
    categoryHues
  ), [calendarHues, calendarSettings, categoryChoices, categoryHues, entries, t]);
  const globalCategories = useMemo(() => categoryOptions.flatMap((option) => {
    const count = calendarTree.reduce((total, node) => total + (
      node.categories.find((category) => category.key === option.key)?.count ?? 0
    ), 0);
    return count > 0 ? [{ ...option, count }] : [];
  }), [calendarTree, categoryOptions]);
  const hiddenCategoryKeySet = useMemo(() => new Set(hiddenCategoryKeys), [hiddenCategoryKeys]);
  const visibleCalendarNames = useMemo(() => new Set(calendarSettings.visibleCalendarNames), [calendarSettings.visibleCalendarNames]);
  const [periodScaleIndex, setPeriodScaleIndex] = useState(() => CHRONICLE_PERIOD_SCALES.indexOf(CHRONICLE_INITIAL_PERIOD_SCALE));
  const periodScale = CHRONICLE_PERIOD_SCALES[periodScaleIndex] ?? CHRONICLE_INITIAL_PERIOD_SCALE;
  const sceneRandomValuesRef = useRef<number[]>([]);
  const scene = useMemo(() => {
    let randomIndex = 0;
    const stableRandom = () => {
      const stored = sceneRandomValuesRef.current[randomIndex];
      if (stored !== undefined) {
        randomIndex += 1;
        return stored;
      }
      const next = Math.random();
      sceneRandomValuesRef.current[randomIndex] = next;
      randomIndex += 1;
      return next;
    };
    return createChronicleCanvasScene(entries, stableRandom, periodScale, calendarSettings);
  }, [calendarSettings, entries, periodScale]);
  const calendarVisibleItems = useMemo(() => scene.items.filter((item) => (
    item.calendarName === calendarSettings.baseCalendarName || calendarSettings.visibleCalendarNames.includes(item.calendarName)
  )), [calendarSettings.baseCalendarName, calendarSettings.visibleCalendarNames, scene.items]);
  const visibleItems = useMemo(() => calendarVisibleItems.filter((item) => !hiddenCategoryKeySet.has(
    chronicleEntryCategoryVisibilityKey(item.entry, calendarSettings.baseCalendarName)
  )), [calendarSettings.baseCalendarName, calendarVisibleItems, hiddenCategoryKeySet]);
  const canvasRuntime = useChronicleCanvasRuntime({
    calendarHues,
    calendarSettings,
    categoryHues,
    entries,
    hiddenCategoryKeys: hiddenCategoryKeySet,
    onOpenFile,
    periodScale,
    scene,
    visibleItems
  });

  const handlePeriodScaleChange = useCallback((nextIndex: number) => {
    const nextPeriodScale = CHRONICLE_PERIOD_SCALES[nextIndex] as ChroniclePeriodScale | undefined;
    if (nextPeriodScale === undefined || nextPeriodScale === periodScale) return;
    canvasRuntime.changePeriodScale(nextPeriodScale);
    setPeriodScaleIndex(nextIndex);
  }, [canvasRuntime, periodScale]);

  const periodScaleText = t("chronicle.periodScaleValue", { count: periodScale });
  const handleCategoryVisibilityChange = useCallback((visibilityKey: string, visible: boolean): void => {
    const next = new Set(hiddenCategoryKeys);
    if (visible) next.delete(visibilityKey);
    else next.add(visibilityKey);
    onHiddenCategoryKeysChange([...next]);
  }, [hiddenCategoryKeys, onHiddenCategoryKeysChange]);
  const handleGlobalCategoryVisibilityChange = useCallback((categoryKey: string, visible: boolean): void => {
    const next = new Set(hiddenCategoryKeys);
    for (const node of calendarTree) {
      for (const category of node.categories) {
        if (category.key !== categoryKey) continue;
        if (visible) next.delete(category.visibilityKey);
        else next.add(category.visibilityKey);
      }
    }
    onHiddenCategoryKeysChange([...next]);
  }, [calendarTree, hiddenCategoryKeys, onHiddenCategoryKeysChange]);
  const handleCalendarVisibilityChange = useCallback((calendarName: string, visible: boolean): void => {
    if (calendarName === calendarSettings.baseCalendarName) {
      const node = calendarTree.find((candidate) => candidate.calendarName === calendarName);
      const next = new Set(hiddenCategoryKeys);
      for (const category of node?.categories ?? []) {
        if (visible) next.delete(category.visibilityKey);
        else next.add(category.visibilityKey);
      }
      onHiddenCategoryKeysChange([...next]);
      return;
    }
    const selected = new Set(calendarSettings.visibleCalendarNames);
    if (visible) selected.add(calendarName);
    else selected.delete(calendarName);
    const orderedNames = [calendarSettings.baseCalendarName, ...calendarSettings.calendars.map((calendar) => calendar.name)];
    onCalendarSettingsSave({
      ...calendarSettings,
      visibleCalendarNames: orderedNames.filter((name) => selected.has(name) || name === calendarSettings.baseCalendarName)
    });
  }, [calendarSettings, calendarTree, hiddenCategoryKeys, onCalendarSettingsSave, onHiddenCategoryKeysChange]);

  return (
    <>
      <div className="chronicle-period-scale">
        <label>{t("chronicle.periodScale")}</label>
        <div className="chronicle-period-scale-control">
          <input
            aria-label={t("chronicle.periodScale")}
            aria-valuetext={periodScaleText}
            max={CHRONICLE_PERIOD_SCALES.length - 1}
            min={0}
            onChange={(event) => handlePeriodScaleChange(Number(event.target.value))}
            step={1}
            type="range"
            value={periodScaleIndex}
          />
          <output>{periodScaleText}</output>
        </div>
        <button
          aria-expanded={calendarSettingsPopover.isOpen}
          className="chronicle-calendar-settings-button"
          onClick={calendarSettingsPopover.toggle}
          ref={calendarSettingsPopover.buttonRef}
          type="button"
        >
          {t("chronicle.calendarSettings")}
        </button>
      </div>
      <div className="chronicle-body">
        <ChronicleCalendarTreeRail
          baseCalendarName={calendarSettings.baseCalendarName}
          collapsed={railCollapsed}
          globalCategories={globalCategories}
          hiddenCategoryKeys={hiddenCategoryKeySet}
          nodes={calendarTree}
          onCalendarVisibilityChange={handleCalendarVisibilityChange}
          onCategoryVisibilityChange={handleCategoryVisibilityChange}
          onCollapsedChange={onRailCollapsedChange}
          onGlobalCategoryVisibilityChange={handleGlobalCategoryVisibilityChange}
          visibleCalendarNames={visibleCalendarNames}
        />
        <div className="chronicle-canvas-wrap">
          <canvas
            aria-label={t("chronicle.timelineAria")}
            className="chronicle-canvas"
            onLostPointerCapture={canvasRuntime.handlePointerCancel}
            onPointerCancel={canvasRuntime.handlePointerCancel}
            onPointerDown={canvasRuntime.handlePointerDown}
            onPointerLeave={canvasRuntime.handlePointerLeave}
            onPointerMove={canvasRuntime.handlePointerMove}
            onPointerUp={canvasRuntime.handlePointerUp}
            onWheel={canvasRuntime.handleWheel}
            ref={canvasRuntime.canvasRef}
          />
          {entries.length > 0 && calendarVisibleItems.length === 0 ? (
            <div className="chronicle-filter-empty">
              <p>{t("chronicle.allCalendarSurfacesHidden")}</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="chronicle-filter-empty"><p>{t("chronicle.empty")}</p></div>
          ) : null}
          {calendarSettingsPopover.isOpen ? (
            <ChronicleCalendarSettingsPanel
              entries={entries}
              onClose={calendarSettingsPopover.close}
              onSave={onCalendarSettingsSave}
              panelRef={calendarSettingsPopover.panelRef}
              settings={calendarSettings}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
