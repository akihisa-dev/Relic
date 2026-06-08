import { useCallback, useEffect, useState } from "react";
import type { PointerEvent } from "react";

import type { ChartEntry, ChartEntryEditKind, ChartSource, UpdateChartEntryInput } from "../../shared/ipc";
import {
  createAdaptiveChroniclePointerDelta,
  createStablePointerDelta,
  chronicleCalendarPatch,
  dateKindPatch,
  type DragPreview
} from "../chronicleTimeline";

interface UseChronicleEntryDragInput {
  activeSource: ChartSource;
  onUpdateEntry?: (input: UpdateChartEntryInput) => Promise<void> | void;
  resetKey: string | null;
  unitWidth: number;
}

export interface ChronicleEntryDrag {
  dragPreview: DragPreview | null;
  startEntryEdit: (
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ) => void;
}

export function useChronicleEntryDrag({
  activeSource,
  onUpdateEntry,
  resetKey,
  unitWidth
}: UseChronicleEntryDragInput): ChronicleEntryDrag {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);

  useEffect(() => {
    setDragPreview(null);
  }, [resetKey]);

  const startEntryEdit = useCallback((
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ): void => {
    if (event.button > 0 || !onUpdateEntry) return;

    event.preventDefault();
    event.stopPropagation();

    const originalStartValue = entry.startValue;
    const originalEndValue = entry.endValue;
    const startClientX = event.clientX;
    const target = event.currentTarget;
    const dragDelta = activeSource === "chronicle"
      ? createAdaptiveChroniclePointerDelta(startClientX, unitWidth, event.timeStamp)
      : createStablePointerDelta(startClientX, unitWidth);
    let currentPreviewRange = { endValue: originalEndValue, startValue: originalStartValue };

    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    const nextRangeForDelta = (delta: number): { endValue: number; startValue: number } => {
      if (kind === "move") {
        return {
          endValue: originalEndValue + delta,
          startValue: originalStartValue + delta
        };
      }

      if (kind === "resize-start") {
        return {
          endValue: originalEndValue,
          startValue: Math.min(originalStartValue + delta, originalEndValue)
        };
      }

      return {
        endValue: Math.max(originalStartValue, originalEndValue + delta),
        startValue: originalStartValue
      };
    };

    const move = (moveEvent: globalThis.PointerEvent): void => {
      const delta = dragDelta(moveEvent.clientX, moveEvent.timeStamp);
      const nextRange = nextRangeForDelta(delta);

      if (
        currentPreviewRange.endValue === nextRange.endValue &&
        currentPreviewRange.startValue === nextRange.startValue
      ) {
        return;
      }

      currentPreviewRange = nextRange;
      setDragPreview({
          editKind: kind,
          path: entry.path,
          source: activeSource,
          ...chronicleCalendarPatch(entry),
          ...dateKindPatch(entry),
          ...nextRange
      });
    };

    const stop = (stopEvent: globalThis.PointerEvent): void => {
      const delta = dragDelta(stopEvent.clientX, stopEvent.timeStamp);
      const nextRange = nextRangeForDelta(delta);

      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", cancel);

      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }

      if (delta === 0) {
        setDragPreview(null);
        return;
      }

      void Promise.resolve(onUpdateEntry({
        endValue: nextRange.endValue,
        kind,
        originalEndValue,
        originalStartValue,
        path: entry.path,
        ...chronicleCalendarPatch(entry),
        ...dateKindPatch(entry),
        source: activeSource,
        startValue: nextRange.startValue
      })).finally(() => setDragPreview(null));
    };

    const cancel = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", cancel);
      setDragPreview(null);
    };

    setDragPreview({
      endValue: entry.endValue,
      editKind: kind,
      path: entry.path,
      source: activeSource,
      ...chronicleCalendarPatch(entry),
      ...dateKindPatch(entry),
      startValue: entry.startValue
    });
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", cancel);
  }, [activeSource, onUpdateEntry, unitWidth]);

  return { dragPreview, startEntryEdit };
}
