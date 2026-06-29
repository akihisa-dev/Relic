import { useCallback, useState } from "react";
import type { PointerEvent } from "react";

import type { ChartEntry, ChartEntryEditKind, ChartSource, UpdateChartEntryInput } from "../../shared/ipc";
import {
  createAdaptiveChroniclePointerDelta,
  chronicleCalendarPatch,
  type DragPreview
} from "../chronicleTimeline";
import { startWindowPointerDrag } from "./windowPointerDrag";

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

export function chronicleRangeForEdit(
  kind: ChartEntryEditKind,
  originalStartValue: number,
  originalEndValue: number,
  delta: number
): { endValue: number; startValue: number } {
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
}

export function useChronicleEntryDrag({
  activeSource,
  onUpdateEntry,
  resetKey,
  unitWidth
}: UseChronicleEntryDragInput): ChronicleEntryDrag {
  const [dragState, setDragState] = useState<{ preview: DragPreview | null; resetKey: string | null }>(() => ({
    preview: null,
    resetKey
  }));

  if (dragState.resetKey !== resetKey) {
    setDragState({ preview: null, resetKey });
  }

  const dragPreview = dragState.resetKey === resetKey ? dragState.preview : null;

  const setDragPreview = useCallback((preview: DragPreview | null): void => {
    setDragState({ preview, resetKey });
  }, [resetKey]);

  const startEntryEdit = useCallback((
    event: PointerEvent<Element>,
    entry: ChartEntry,
    kind: ChartEntryEditKind
  ): void => {
    if (event.button > 0 || !onUpdateEntry) return;

    event.stopPropagation();

    const originalStartValue = entry.startValue;
    const originalEndValue = entry.endValue;
    const startClientX = event.clientX;
    const target = event.currentTarget;
    const dragDelta = createAdaptiveChroniclePointerDelta(startClientX, unitWidth, event.timeStamp);
    let currentPreviewRange = { endValue: originalEndValue, startValue: originalStartValue };

    const nextRangeForDelta = (delta: number): { endValue: number; startValue: number } => chronicleRangeForEdit(kind, originalStartValue, originalEndValue, delta);

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
          ...nextRange
      });
    };

    const stop = (stopEvent: globalThis.PointerEvent): void => {
      const delta = dragDelta(stopEvent.clientX, stopEvent.timeStamp);
      const nextRange = nextRangeForDelta(delta);

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
        source: activeSource,
        startValue: nextRange.startValue
      })).finally(() => setDragPreview(null));
    };

    const cancel = (): void => {
      setDragPreview(null);
    };

    setDragPreview({
      endValue: entry.endValue,
      editKind: kind,
      path: entry.path,
      source: activeSource,
      ...chronicleCalendarPatch(entry),
      startValue: entry.startValue
    });
    startWindowPointerDrag({
      event,
      onCancel: cancel,
      onMove: move,
      onUp: stop,
      pointerCaptureTarget: target
    });
  }, [activeSource, onUpdateEntry, setDragPreview, unitWidth]);

  return { dragPreview, startEntryEdit };
}
