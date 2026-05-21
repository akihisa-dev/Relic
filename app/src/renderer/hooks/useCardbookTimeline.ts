import { useCallback, useEffect, useState } from "react";

import type {
  UpdateTimelineChartEntryInput,
  CardbookTimelineChart,
  CardbookState
} from "../../shared/ipc";
import {
  normalizeCardbookTimeline,
  normalizeCardbookTimelineWithCards,
  updateTimelineEntryFallback
} from "../timelineChartData";
import type { Tab } from "../store/editorStore";

interface UseCardbookTimelineInput {
  hasOpenTimeline: boolean;
  setCardbookError: (message: string | null) => void;
  tabs: Record<string, Tab>;
  updateTabContent: (tabId: string, content: string) => void;
  cardbookState: CardbookState | null;
}

export function useCardbookTimeline({
  hasOpenTimeline,
  setCardbookError,
  tabs,
  updateTabContent,
  cardbookState
}: UseCardbookTimelineInput): {
  timelineCharts: CardbookTimelineChart[];
  handleUpdateTimelineEntry: (input: UpdateTimelineChartEntryInput) => Promise<void>;
  reloadTimeline: () => Promise<void>;
} {
  const [timelineCharts, setTimelineCharts] = useState<CardbookTimelineChart[]>([]);

  const reloadTimeline = useCallback(async (): Promise<void> => {
    if (!cardbookState?.activeCardbook || !window.relic) {
      setTimelineCharts([]);
      return;
    }

    const result = await window.relic.getCardbookTimeline();

    if (result.ok) {
      const normalized = hasOpenTimeline
        ? await normalizeCardbookTimelineWithCards(result.value, cardbookState.cardTree, window.relic.readMarkdownCard)
        : normalizeCardbookTimeline(result.value);
      setTimelineCharts(normalized);
    } else {
      setTimelineCharts([]);
      setCardbookError(result.error.message);
    }
  }, [hasOpenTimeline, setCardbookError, cardbookState?.activeCardbook?.id, cardbookState?.cardTree]);

  useEffect(() => {
    if (!cardbookState?.activeCardbook || !window.relic) {
      setTimelineCharts([]);
      return;
    }

    let canceled = false;

    void window.relic.getCardbookTimeline().then((result) => {
      if (canceled) return;

      if (result.ok) {
        setTimelineCharts(normalizeCardbookTimeline(result.value));
      } else {
        setTimelineCharts([]);
        setCardbookError(result.error.message);
      }
    });

    return () => {
      canceled = true;
    };
  }, [setCardbookError, cardbookState?.activeCardbook?.id, cardbookState?.cardTree]);

  useEffect(() => {
    if (!hasOpenTimeline) return;
    void reloadTimeline();
  }, [hasOpenTimeline, reloadTimeline]);

  const handleUpdateTimelineEntry = useCallback(async (input: UpdateTimelineChartEntryInput): Promise<void> => {
    if (!window.relic) return;

    const relic = window.relic;
    const updateEntry = (relic as Partial<typeof relic>).updateTimelineChartEntry;
    const result = typeof updateEntry === "function"
      ? await updateEntry(input).catch(() => updateTimelineEntryFallback(input, relic))
      : await updateTimelineEntryFallback(input, relic);

    if (result.ok) {
      setTimelineCharts(await normalizeCardbookTimelineWithCards(result.value, cardbookState?.cardTree ?? [], relic.readMarkdownCard));
      const updatedCard = await relic.readMarkdownCard({ path: input.path });

      if (updatedCard.ok) {
        Object.values(tabs).forEach((tab) => {
          if (tab.kind === "card" && tab.path === input.path) {
            updateTabContent(tab.id, updatedCard.value.content);
          }
        });
      }
    } else {
      setCardbookError(result.error.message);
    }
  }, [setCardbookError, tabs, updateTabContent, cardbookState?.cardTree]);

  return {
    timelineCharts,
    handleUpdateTimelineEntry,
    reloadTimeline
  };
}
