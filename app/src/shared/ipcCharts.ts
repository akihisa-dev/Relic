export type ChartSource = "chronicle";
export type ChronicleCalendarId =
  | "chronicle0"
  | "chronicle1"
  | "chronicle2"
  | "chronicle3"
  | "chronicle4"
  | "chronicle5"
  | "chronicle6"
  | "chronicle7"
  | "chronicle8"
  | "chronicle9";

export interface ChronicleCalendarSettings {
  id: ChronicleCalendarId;
  name: string;
  startYear?: number;
}

export const chronicleCalendarIds: ChronicleCalendarId[] = [
  "chronicle0",
  "chronicle1",
  "chronicle2",
  "chronicle3",
  "chronicle4",
  "chronicle5",
  "chronicle6",
  "chronicle7",
  "chronicle8",
  "chronicle9"
];

export const defaultChronicleCalendars: ChronicleCalendarSettings[] = [
  { id: "chronicle0", name: "メイン暦" }
];

export interface ChartSettings {
  filePaths?: string[];
  id: string;
  name: string;
  source: ChartSource;
}

export interface ChartEntry {
  chronicleCalendarId?: ChronicleCalendarId;
  chronicleCalendarName?: string;
  chronicleCalendarStartYear?: number;
  endLabel: string;
  endValue: number;
  fileName: string;
  path: string;
  startLabel: string;
  startValue: number;
}

export interface WorkspaceChart extends ChartSettings {
  entries: ChartEntry[];
}

export type ChartEntryEditKind = "move" | "resize-start" | "resize-end";

export interface UpdateChartEntryInput {
  chronicleCalendarId?: ChronicleCalendarId;
  chronicleCalendarStartYear?: number;
  endValue: number;
  kind: ChartEntryEditKind;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: ChartSource;
  startValue: number;
}
