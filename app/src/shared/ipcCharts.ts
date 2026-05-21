export type TimelineChartSource = "timeline";

export interface TimelineChartSettings {
  cardPaths?: string[];
  id: string;
  name: string;
  source: TimelineChartSource;
}

export interface TimelineChartEntry {
  endLabel: string;
  endValue: number;
  cardName: string;
  path: string;
  startLabel: string;
  startValue: number;
  statuses?: string[];
}

export interface CardbookTimelineChart extends TimelineChartSettings {
  entries: TimelineChartEntry[];
}

export type TimelineChartEntryEditKind = "move" | "resize-start" | "resize-end";

export interface UpdateTimelineChartEntryInput {
  endValue: number;
  kind: TimelineChartEntryEditKind;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: TimelineChartSource;
  startValue: number;
}
