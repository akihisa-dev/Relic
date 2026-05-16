import type { GanttChartSource } from "../shared/ipc";

export const ROW_HEIGHT = 38;
export const CHRONICLE_NAME_COLUMN_WIDTH = 300;
export const DATE_NAME_COLUMN_WIDTH = 430;
export const TICK_WIDTH = 72;
export const DATE_TICK_WIDTH = 52;
export const LABEL_HORIZONTAL_PADDING = 14;
export const CHRONICLE_FINE_DRAG_SPEED = 0.18;
export const CHRONICLE_FAST_DRAG_SPEED = 1.4;
export const CHRONICLE_FINE_DRAG_MULTIPLIER = 0.65;
export const CHRONICLE_FAST_DRAG_MULTIPLIER = 1.35;
export const SCALE_OPTIONS: Record<GanttChartSource, readonly number[]> = {
  chronicle: [1, 10, 100],
  date: [0, 1, 2]
};

export const DATE_SCALES = [
  { label: "日", step: 1, unit: "day" },
  { label: "月", step: null, unit: "month" },
  { label: "年", step: null, unit: "year" }
] as const;

export type DateScale = typeof DATE_SCALES[number];
export type DateScaleUnit = DateScale["unit"];
export type DateAxisSegmentUnit = DateScaleUnit | "month" | "year";
