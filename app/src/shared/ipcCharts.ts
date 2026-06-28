export type ChartSource = "chronicle";

export interface ChronicleCalendarSettings {
  name: string;
  startYear?: number;
}

export const defaultChronicleCalendars: ChronicleCalendarSettings[] = [
  { name: "メイン暦" }
];

export interface ChroniclePoint {
  month: number | null;
  year: number;
}

export interface ChartSettings {
  filePaths?: string[];
  id: string;
  name: string;
  source: ChartSource;
}

export interface ChartEntry {
  chronicleCalendarName: string;
  chronicleCalendarStartYear?: number;
  chronicleEntryIndex: number;
  endLabel: string;
  endValue: number;
  fileName: string;
  path: string;
  startPoint: ChroniclePoint;
  endPoint: ChroniclePoint;
  startLabel: string;
  startValue: number;
}

export interface WorkspaceChart extends ChartSettings {
  entries: ChartEntry[];
}

export type ChartEntryEditKind = "move" | "resize-start" | "resize-end";

export interface UpdateChartEntryInput {
  endValue: number;
  kind: ChartEntryEditKind;
  chronicleEntryIndex: number;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: ChartSource;
  startValue: number;
}
