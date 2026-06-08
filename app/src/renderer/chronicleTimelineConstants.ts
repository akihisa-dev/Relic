export const ROW_HEIGHT = 38;
export const DATE_NAME_COLUMN_WIDTH = 430;
export const CHRONICLE_TICK_WIDTH = 96;
export const LABEL_HORIZONTAL_PADDING = 14;
export const CHRONICLE_FINE_DRAG_SPEED = 0.18;
export const CHRONICLE_FAST_DRAG_SPEED = 1.4;
export const CHRONICLE_FINE_DRAG_MULTIPLIER = 0.65;
export const CHRONICLE_FAST_DRAG_MULTIPLIER = 1.35;

export const DATE_SCALES = [
  { label: "日", step: 1, unit: "day" }
] as const;

export type DateScale = typeof DATE_SCALES[number];
export type DateScaleUnit = DateScale["unit"];
export type DateAxisSegmentUnit = DateScaleUnit | "month" | "year";
