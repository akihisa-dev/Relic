export type GanttChartSource = "chronicle" | "date";
export type GanttChartDateKind = "actual" | "planned";
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

export interface GanttChartSettings {
  filePaths?: string[];
  id: string;
  name: string;
  source: GanttChartSource;
}

export interface GanttChartEntry {
  chronicleCalendarId?: ChronicleCalendarId;
  chronicleCalendarName?: string;
  chronicleCalendarStartYear?: number;
  dateKind?: GanttChartDateKind;
  endLabel: string;
  endValue: number;
  fileName: string;
  path: string;
  startLabel: string;
  startValue: number;
  statuses?: string[];
}

export interface WorkspaceGanttChart extends GanttChartSettings {
  entries: GanttChartEntry[];
}

export type GanttChartEntryEditKind = "move" | "resize-start" | "resize-end";

export interface UpdateGanttChartEntryInput {
  chronicleCalendarId?: ChronicleCalendarId;
  chronicleCalendarStartYear?: number;
  dateKind?: GanttChartDateKind;
  endValue: number;
  kind: GanttChartEntryEditKind;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}
