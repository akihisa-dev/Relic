export const ROW_HEIGHT = 38;
export const CHRONICLE_NAME_COLUMN_WIDTH = 300;
export const DATE_NAME_COLUMN_WIDTH = 430;
export const TICK_WIDTH = 72;
export const DATE_TICK_WIDTH = 52;
export const CHART_ZOOM_LEVELS = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 1.5, 2.25, 3] as const;
export const DEFAULT_CHART_ZOOM_INDEX = 5;
export const LABEL_HORIZONTAL_PADDING = 14;
export const CHRONICLE_FINE_DRAG_SPEED = 0.18;
export const CHRONICLE_FAST_DRAG_SPEED = 1.4;
export const CHRONICLE_FINE_DRAG_MULTIPLIER = 0.65;
export const CHRONICLE_FAST_DRAG_MULTIPLIER = 1.35;

export const DATE_SCALES = [
  { label: "日", step: 1, unit: "day" },
  { label: "月", step: null, unit: "month" },
  { label: "年", step: null, unit: "year" }
] as const;

export type DateScale = typeof DATE_SCALES[number];
export type DateScaleUnit = DateScale["unit"];
export type DateAxisSegmentUnit = DateScaleUnit | "month" | "year";
