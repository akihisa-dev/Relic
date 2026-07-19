import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactElement, type WheelEvent } from "react";

import type { ChartEntry } from "../../shared/ipc";
import {
  chronicleCalendarNames,
  type ChronicleCalendarSettings
} from "../../shared/chronicleCalendar";
import { cancelChronicleCanvasFrame, chronicleCanvasWheelFactor } from "../chronicleCanvasHelpers";
import {
  createChronicleCategoryOptions,
  isChronicleEntryVisible,
  pruneChronicleHiddenCategoryKeys
} from "../chronicleCategoryModel";
import {
  CHRONICLE_INITIAL_PERIOD_SCALE,
  CHRONICLE_CANVAS_MAX_SCALE,
  CHRONICLE_CANVAS_MIN_SCALE,
  CHRONICLE_PERIOD_SCALES,
  changeChronicleCanvasPeriodScale,
  chronicleCanvasYearHeaderHeight,
  chronicleCanvasClickPath,
  chronicleCanvasPointerItemAtPoint,
  chronicleCanvasPointerMovedBeyondClickThreshold,
  createChronicleCanvasCamera,
  createChronicleCanvasScene,
  initializeChronicleCanvasCamera,
  prepareChronicleCanvasPointerCancel,
  stepChronicleCanvasInertia,
  stepChronicleCanvasScene,
  zoomChronicleCanvasAtPoint,
  type ChronicleCanvasItem,
  type ChronicleCanvasPoint,
  type ChroniclePeriodScale
} from "../chronicleCanvasModel";
import { drawChronicleCanvas, type ChronicleCanvasTheme } from "../chronicleCanvasRenderer";
import { useLatest } from "../hooks/useLatest";
import { useT } from "../i18n";
import { ChronicleCategoryRail } from "./ChronicleCategoryRail";

interface ChronicleCanvasProps {
  calendarSettings?: ChronicleCalendarSettings;
  categoryChoices?: string[];
  entries: ChartEntry[];
  hiddenCategoryKeys?: string[];
  onOpenFile: (path: string) => void;
  onHiddenCategoryKeysChange?: (keys: string[]) => void;
  onCalendarSettingsSave?: (settings: ChronicleCalendarSettings) => void;
  onRailCollapsedChange?: (collapsed: boolean) => void;
  railCollapsed?: boolean;
}

interface PointerSession {
  item: ChronicleCanvasItem | null;
  lastX: number;
  lastY: number;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  type: "item" | "pan";
}

interface ChronicleCalendarSettingsDraft {
  baseCalendarName: string;
  calendars: Array<{ name: string; yearOne: string }>;
  visibleCalendarNames: string[];
}

const emptyCategoryChoices: string[] = [];
const emptyHiddenCategoryKeys: string[] = [];

export function ChronicleCanvas({
  calendarSettings = { baseCalendarName: "西暦", calendars: [], visibleCalendarNames: ["西暦"] },
  categoryChoices = emptyCategoryChoices,
  entries,
  hiddenCategoryKeys = emptyHiddenCategoryKeys,
  onOpenFile,
  onHiddenCategoryKeysChange = () => undefined,
  onCalendarSettingsSave = () => undefined,
  onRailCollapsedChange = () => undefined,
  railCollapsed = false
}: ChronicleCanvasProps): ReactElement {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenCategoryKeySet = useMemo(() => new Set(hiddenCategoryKeys), [hiddenCategoryKeys]);
  const categoryOptions = useMemo(() => createChronicleCategoryOptions(
    entries,
    categoryChoices,
    t("chronicle.uncategorized")
  ), [categoryChoices, entries, t]);
  const categoryHues = useMemo(() => new Map(categoryOptions.flatMap((option) => (
    option.hue === null ? [] : [[option.key, option.hue] as const]
  ))), [categoryOptions]);
  const [periodScaleIndex, setPeriodScaleIndex] = useState(() => CHRONICLE_PERIOD_SCALES.indexOf(CHRONICLE_INITIAL_PERIOD_SCALE));
  const [calendarSettingsOpen, setCalendarSettingsOpen] = useState(false);
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
    return createChronicleCanvasScene(entries, stableRandom, periodScale);
  }, [entries, periodScale]);
  const sceneRef = useLatest(scene);
  const entriesRef = useLatest(entries);
  const categoryHuesRef = useLatest(categoryHues);
  const hiddenCategoryKeysRef = useLatest(hiddenCategoryKeySet);
  const visibleItems = useMemo(() => scene.items.filter((item) => (
    isChronicleEntryVisible(item.entry, hiddenCategoryKeySet)
  )), [hiddenCategoryKeySet, scene.items]);
  const visibleItemsRef = useLatest(visibleItems);
  const [camera] = useState(createChronicleCanvasCamera);
  const initializedEntriesRef = useRef<ChartEntry[] | null>(null);
  const pointerRef = useRef<PointerSession | null>(null);
  const hoveredItemIdRef = useRef<string | null>(null);
  const hoveredPointRef = useRef<ChronicleCanvasPoint | null>(null);
  const previousFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const simulationActiveRef = useRef(false);
  const lastPanDeltaRef = useRef({ x: 0, y: 0 });
  const openFileRef = useLatest(onOpenFile);
  const themeRef = useRef<ChronicleCanvasTheme>({
    background: "#f4f0e6",
    categoryLightness: 40,
    categorySaturation: 68,
    mutedText: "#76756c",
    text: "#1a1b17"
  });

  const updateTheme = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const styles = getComputedStyle(canvas);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    const percentage = (name: string, fallback: number) => Number.parseFloat(token(name, String(fallback))) || fallback;
    themeRef.current = {
      background: token("--color-bg", "#f4f0e6"),
      categoryLightness: percentage("--chronicle-category-lightness", 40),
      categorySaturation: percentage("--chronicle-category-saturation", 68),
      mutedText: token("--color-text-secondary", "#62625b"),
      text: token("--color-text", "#1a1b17")
    };
  }, []);

  const draw = useCallback((timestamp: number) => {
    animationFrameRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvasContext(canvas);
    if (!context) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || 720);
    const height = Math.max(1, rect.height || 420);
    const pixelRatio = window.devicePixelRatio || 1;
    const nextWidth = Math.floor(width * pixelRatio);
    const nextHeight = Math.floor(height * pixelRatio);
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      updateTheme();
    }
    if (initializedEntriesRef.current !== entriesRef.current) {
      initializedEntriesRef.current = entriesRef.current;
      initializeChronicleCanvasCamera(camera, sceneRef.current, width, height);
    }

    const previous = previousFrameRef.current ?? timestamp;
    previousFrameRef.current = timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(1 / 240, (timestamp - previous) / 1000));
    const draggedItemId = pointerRef.current?.type === "item" ? pointerRef.current.item?.id ?? null : null;
    let simulationMoving = false;
    if (draggedItemId || simulationActiveRef.current) {
      simulationActiveRef.current = stepChronicleCanvasScene(visibleItemsRef.current, draggedItemId, deltaSeconds);
      simulationMoving = simulationActiveRef.current;
    }
    const inertiaMoving = pointerRef.current?.type !== "pan" && stepChronicleCanvasInertia(camera);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawChronicleCanvas(
      context,
      sceneRef.current,
      camera,
      hoveredItemIdRef.current,
      hoveredPointRef.current,
      width,
      height,
      themeRef.current,
      hiddenCategoryKeysRef.current,
      categoryHuesRef.current,
      calendarSettings
    );
    if (simulationMoving || inertiaMoving || draggedItemId) {
      animationFrameRef.current = requestAnimationFrame(draw);
    }
  }, [calendarSettings, updateTheme]);

  useEffect(() => {
    updateTheme();
    requestCanvasFrame(animationFrameRef, draw);
    const observer = new MutationObserver(() => {
      updateTheme();
      requestCanvasFrame(animationFrameRef, draw);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => requestCanvasFrame(animationFrameRef, draw));
    if (canvasRef.current) resizeObserver?.observe(canvasRef.current);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      cancelChronicleCanvasFrame(animationFrameRef);
    };
  }, [draw, updateTheme]);

  useEffect(() => {
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw, scene]);

  useEffect(() => {
    const prunedKeys = pruneChronicleHiddenCategoryKeys(hiddenCategoryKeys, categoryOptions);
    if (prunedKeys.length !== hiddenCategoryKeys.length) onHiddenCategoryKeysChange(prunedKeys);
  }, [categoryOptions, hiddenCategoryKeys, onHiddenCategoryKeysChange]);

  useEffect(() => {
    const hoveredItemId = hoveredItemIdRef.current;
    if (hoveredItemId && !scene.items.some((item) => (
      item.id === hoveredItemId && isChronicleEntryVisible(item.entry, hiddenCategoryKeySet)
    ))) {
      hoveredItemIdRef.current = null;
      hoveredPointRef.current = null;
    }
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw, hiddenCategoryKeySet, scene.items]);

  const canvasPoint = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);
  const pointerItemAt = useCallback((point: ChronicleCanvasPoint): ChronicleCanvasItem | null => {
    if (point.y < chronicleCanvasYearHeaderHeight(camera.scale, calendarSettings.visibleCalendarNames.length)) return null;
    return chronicleCanvasPointerItemAtPoint(visibleItemsRef.current, camera, point);
  }, [calendarSettings.visibleCalendarNames.length, camera]);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    const point = canvasPoint(event.clientX, event.clientY);
    const item = pointerItemAt(point);
    event.currentTarget.setPointerCapture(event.pointerId);
    camera.velocityX = 0;
    camera.velocityY = 0;
    lastPanDeltaRef.current = { x: 0, y: 0 };
    pointerRef.current = {
      item,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      type: item ? "item" : "pan"
    };
    event.currentTarget.style.cursor = "grabbing";
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw, pointerItemAt]);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event.clientX, event.clientY);
    const hovered = pointerItemAt(point);
    const hoveredChanged = hoveredItemIdRef.current !== (hovered?.id ?? null);
    const hoveredPointChanged = hovered
      ? hoveredPointRef.current?.x !== point.x || hoveredPointRef.current?.y !== point.y
      : hoveredPointRef.current !== null;
    hoveredItemIdRef.current = hovered?.id ?? null;
    hoveredPointRef.current = hovered ? point : null;
    const pointer = pointerRef.current;
    event.currentTarget.style.cursor = pointer ? "grabbing" : hovered ? "pointer" : "grab";
    if (!pointer) {
      if (hoveredChanged || hoveredPointChanged) requestCanvasFrame(animationFrameRef, draw);
      return;
    }

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.moved ||= chronicleCanvasPointerMovedBeyondClickThreshold(
      { x: pointer.startX, y: pointer.startY },
      { x: event.clientX, y: event.clientY }
    );
    if (pointer.type === "pan") {
      camera.panX += dx;
      camera.panY += dy;
      lastPanDeltaRef.current = { x: dx, y: dy };
      requestCanvasFrame(animationFrameRef, draw);
      return;
    }
    if (pointer.item) {
      pointer.item.x += dx / camera.scale;
      pointer.item.y += dy / camera.scale;
      pointer.item.vx = dx / camera.scale;
      pointer.item.vy = dy / camera.scale;
      simulationActiveRef.current = true;
    }
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw, pointerItemAt]);

  const handlePointerUp = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) event.currentTarget.releasePointerCapture(pointer.pointerId);
    if (pointer.type === "pan") {
      camera.velocityX = lastPanDeltaRef.current.x * 0.88;
      camera.velocityY = lastPanDeltaRef.current.y * 0.88;
    } else {
      const path = chronicleCanvasClickPath(pointer.item, pointer.moved);
      if (path) openFileRef.current(path);
      else simulationActiveRef.current = true;
    }
    pointerRef.current = null;
    const point = canvasPoint(event.clientX, event.clientY);
    const hovered = pointerItemAt(point);
    event.currentTarget.style.cursor = hovered ? "pointer" : "grab";
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw, pointerItemAt]);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const pointer = pointerRef.current;
    if (!pointer) return;
    if (event.currentTarget.hasPointerCapture(pointer.pointerId)) event.currentTarget.releasePointerCapture(pointer.pointerId);
    pointerRef.current = null;
    lastPanDeltaRef.current = { x: 0, y: 0 };
    simulationActiveRef.current = prepareChronicleCanvasPointerCancel(camera, pointer.item, pointer.moved);
    event.currentTarget.style.cursor = "grab";
    requestCanvasFrame(animationFrameRef, draw);
  }, [draw]);

  const handleWheel = useCallback((event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = canvasPoint(event.clientX, event.clientY);
    const factor = chronicleCanvasWheelFactor(event.deltaY);
    const nextScale = Math.min(CHRONICLE_CANVAS_MAX_SCALE, Math.max(CHRONICLE_CANVAS_MIN_SCALE, camera.scale * factor));
    zoomChronicleCanvasAtPoint(camera, nextScale, point);
    requestCanvasFrame(animationFrameRef, draw);
  }, [canvasPoint, draw]);

  const handlePeriodScaleChange = useCallback((nextIndex: number) => {
    const nextPeriodScale = CHRONICLE_PERIOD_SCALES[nextIndex] as ChroniclePeriodScale | undefined;
    if (nextPeriodScale === undefined || nextPeriodScale === periodScale) return;
    const viewportWidth = canvasRef.current?.getBoundingClientRect().width || 720;
    changeChronicleCanvasPeriodScale(camera, periodScale, nextPeriodScale, viewportWidth);
    setPeriodScaleIndex(nextIndex);
  }, [periodScale]);

  const periodScaleText = t("chronicle.periodScaleValue", { count: periodScale });

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
          aria-expanded={calendarSettingsOpen}
          className="chronicle-calendar-settings-button"
          onClick={() => setCalendarSettingsOpen((open) => !open)}
          type="button"
        >
          {t("chronicle.calendarSettings")}
        </button>
      </div>
      <div className="chronicle-body">
        <ChronicleCategoryRail
          collapsed={railCollapsed}
          hiddenCategoryKeys={hiddenCategoryKeySet}
          onCollapsedChange={onRailCollapsedChange}
          onHiddenCategoryKeysChange={onHiddenCategoryKeysChange}
          options={categoryOptions}
        />
        <div className="chronicle-canvas-wrap">
          <canvas
            aria-label={t("chronicle.timelineAria")}
            className="chronicle-canvas"
            onPointerCancel={handlePointerCancel}
            onPointerDown={handlePointerDown}
            onPointerLeave={() => {
              hoveredItemIdRef.current = null;
              hoveredPointRef.current = null;
              if (!pointerRef.current) canvasRef.current?.style.setProperty("cursor", "grab");
              requestCanvasFrame(animationFrameRef, draw);
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            ref={canvasRef}
          />
          {entries.length > 0 && visibleItems.length === 0 ? (
            <div className="chronicle-filter-empty">
              <p>{t("chronicle.allCategoriesHidden")}</p>
              <button onClick={() => onHiddenCategoryKeysChange([])} type="button">
                {t("chronicle.showAllCategories")}
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="chronicle-filter-empty"><p>{t("chronicle.empty")}</p></div>
          ) : null}
          {calendarSettingsOpen ? (
            <ChronicleCalendarSettingsPanel
              entries={entries}
              onClose={() => setCalendarSettingsOpen(false)}
              onSave={onCalendarSettingsSave}
              settings={calendarSettings}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function ChronicleCalendarSettingsPanel({
  entries,
  onClose,
  onSave,
  settings
}: {
  entries: ChartEntry[];
  onClose: () => void;
  onSave: (settings: ChronicleCalendarSettings) => void;
  settings: ChronicleCalendarSettings;
}): ReactElement {
  const t = useT();
  const [draft, setDraft] = useState(() => createCalendarSettingsDraft(settings));
  useEffect(() => setDraft(createCalendarSettingsDraft(settings)), [settings]);
  const names = [draft.baseCalendarName, ...draft.calendars.map((calendar) => calendar.name)];
  const usedNames = useMemo(() => new Set(entries.flatMap((entry) => entry.calendarName ? [entry.calendarName] : [])), [entries]);
  const save = (next: ChronicleCalendarSettingsDraft): void => {
    const calendars = next.calendars.flatMap((calendar) => {
      const yearOne = parseCalendarYearOne(calendar.yearOne);
      return yearOne === null ? [] : [{ name: calendar.name.trim(), yearOne }];
    });
    if (calendars.length !== next.calendars.length) return;
    const normalized = {
      baseCalendarName: next.baseCalendarName.trim(),
      calendars,
      visibleCalendarNames: next.visibleCalendarNames
    };
    const normalizedNames = chronicleCalendarNames(normalized);
    if (!normalized.baseCalendarName || new Set(normalizedNames).size !== normalizedNames.length ||
      normalized.calendars.some((calendar) => !calendar.name || calendar.yearOne === 0 || !Number.isInteger(calendar.yearOne))) return;
    const visibleCalendarNames = normalized.visibleCalendarNames.filter((name) => normalizedNames.includes(name));
    const complete = { ...normalized, visibleCalendarNames: visibleCalendarNames.length > 0 ? visibleCalendarNames : [normalized.baseCalendarName] };
    setDraft(createCalendarSettingsDraft(complete));
    onSave(complete);
  };
  const toggleVisible = (name: string): void => {
    const visible = draft.visibleCalendarNames.includes(name)
      ? draft.visibleCalendarNames.filter((candidate) => candidate !== name)
      : [...draft.visibleCalendarNames, name];
    if (visible.length > 0) save({ ...draft, visibleCalendarNames: visible });
  };
  return (
    <section aria-label={t("chronicle.calendarSettings")} className="chronicle-calendar-settings-panel">
      <header>
        <h2>{t("chronicle.calendarSettings")}</h2>
        <button aria-label={t("chronicle.closeCalendarSettings")} onClick={onClose} type="button">×</button>
      </header>
      <div className="chronicle-calendar-settings-content">
        <h3>{t("chronicle.visibleCalendars")}</h3>
        <div className="chronicle-calendar-visible-list">
          {names.map((name) => (
            <label key={name}>
              <input checked={draft.visibleCalendarNames.includes(name)} onChange={() => toggleVisible(name)} type="checkbox" />
              <span>{name}</span>
            </label>
          ))}
        </div>
        <h3>{t("chronicle.baseCalendar")}</h3>
        <label className="chronicle-calendar-field">
          <span>{t("chronicle.calendarName")}</span>
          <input
            onBlur={() => save(draft)}
            onChange={(event) => {
              const previous = draft.baseCalendarName;
              const name = event.target.value;
              setDraft({
                ...draft,
                baseCalendarName: name,
                visibleCalendarNames: draft.visibleCalendarNames.map((candidate) => candidate === previous ? name : candidate)
              });
            }}
            value={draft.baseCalendarName}
          />
        </label>
        <h3>{t("chronicle.otherCalendars")}</h3>
        <div className="chronicle-calendar-definition-list">
          {draft.calendars.map((calendar, index) => (
            <div className="chronicle-calendar-definition" key={index}>
              <input
                aria-label={t("chronicle.calendarName")}
                disabled={usedNames.has(calendar.name)}
                onBlur={() => save(draft)}
                onChange={(event) => {
                  const previous = calendar.name;
                  const name = event.target.value;
                  setDraft({
                    ...draft,
                    calendars: draft.calendars.map((item, itemIndex) => itemIndex === index ? { ...item, name } : item),
                    visibleCalendarNames: draft.visibleCalendarNames.map((candidate) => candidate === previous ? name : candidate)
                  });
                }}
                value={calendar.name}
              />
              <label>
                <span>{t("chronicle.yearOneEqualsBase")}</span>
                <input
                  inputMode="numeric"
                  onBlur={() => save(draft)}
                  onChange={(event) => setDraft({ ...draft, calendars: draft.calendars.map((item, itemIndex) => itemIndex === index ? { ...item, yearOne: event.target.value } : item) })}
                  pattern="-?[0-9]*"
                  type="text"
                  value={calendar.yearOne}
                />
                <span>{t("chronicle.yearSuffix")}</span>
              </label>
              <button
                aria-label={t("chronicle.removeCalendar", { name: calendar.name })}
                disabled={usedNames.has(calendar.name)}
                onClick={() => save({ ...draft, calendars: draft.calendars.filter((_, itemIndex) => itemIndex !== index), visibleCalendarNames: draft.visibleCalendarNames.filter((name) => name !== calendar.name) })}
                type="button"
              >×</button>
            </div>
          ))}
        </div>
        <button
          className="chronicle-calendar-add"
          onClick={() => {
            const baseName = t("chronicle.newCalendar");
            let name = baseName;
            let suffix = 2;
            while (names.includes(name)) name = `${baseName} ${suffix++}`;
            setDraft({ ...draft, calendars: [...draft.calendars, { name, yearOne: "1" }] });
          }}
          type="button"
        >＋ {t("chronicle.addCalendar")}</button>
      </div>
    </section>
  );
}

function createCalendarSettingsDraft(settings: ChronicleCalendarSettings): ChronicleCalendarSettingsDraft {
  return {
    ...settings,
    calendars: settings.calendars.map((calendar) => ({ ...calendar, yearOne: String(calendar.yearOne) }))
  };
}

function parseCalendarYearOne(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const yearOne = Number(normalized);
  return Number.isInteger(yearOne) && yearOne !== 0 ? yearOne : null;
}

function requestCanvasFrame(
  frameRef: { current: number | null },
  draw: (timestamp: number) => void
): void {
  if (frameRef.current !== null) return;
  frameRef.current = requestAnimationFrame(draw);
}

function canvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) return null;
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}
