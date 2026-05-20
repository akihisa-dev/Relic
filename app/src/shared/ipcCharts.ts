export type GanttChartSource = "chronicle";

export interface GanttChartSettings {
  filePaths?: string[];
  id: string;
  name: string;
  source: GanttChartSource;
}

export interface GanttChartEntry {
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
  endValue: number;
  kind: GanttChartEntryEditKind;
  originalEndValue: number;
  originalStartValue: number;
  path: string;
  source: GanttChartSource;
  startValue: number;
}
