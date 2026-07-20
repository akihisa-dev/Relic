import {
  CHRONICLE_CANVAS_ITEM_LABEL_OFFSET,
  CHRONICLE_CANVAS_LABEL_HEIGHT,
  chronicleCanvasTextOpacity,
  chronicleCanvasYearHeaderHeight,
  chronicleCanvasYearLabelY,
  chronicleCanvasYearFontSize,
  chronicleCanvasYearOpacity,
  visibleChronicleCanvasYearLabels,
  visibleChronicleCanvasYears,
  worldToCanvas,
  type ChronicleCanvasCamera,
  type ChronicleCanvasItem,
  type ChronicleCanvasLabelHit,
  type ChronicleCanvasPoint,
  type ChronicleCanvasScene,
  type ChronicleCanvasYear
} from "./chronicleCanvasModel";
import {
  chronicleCategoryKey
} from "./chronicleCategoryModel";
import { chronicleEntryCategoryVisibilityKey } from "./chronicleCalendarTreeModel";
import {
  baseYearToCalendarYear,
  defaultChronicleCalendarSettings,
  type ChronicleCalendarSettings
} from "../shared/chronicleCalendar";

const nodeRadius = 6;
const itemLabelFontFamily = "-apple-system, BlinkMacSystemFont, sans-serif";
const itemLabelFontSize = 12;
const hoveredItemLabelFontSize = 14;
const hoveredItemGlowBlur = 10;
const itemLabelGap = 8;
const itemRangeFont = "650 11px -apple-system, BlinkMacSystemFont, sans-serif";

export interface ChronicleCanvasTheme {
  background: string;
  categoryLightness: number;
  categorySaturation: number;
  mutedText: string;
  text: string;
}

export interface ChronicleCanvasDrawResult {
  labelHits: ChronicleCanvasLabelHit[];
}

export function drawChronicleCanvas(
  context: CanvasRenderingContext2D,
  scene: ChronicleCanvasScene,
  camera: ChronicleCanvasCamera,
  hoveredItemId: string | null,
  hoveredPoint: ChronicleCanvasPoint | null,
  viewportWidth: number,
  viewportHeight: number,
  theme: ChronicleCanvasTheme,
  categoryHues: ReadonlyMap<string, number> = new Map(),
  calendarSettings?: ChronicleCalendarSettings,
  calendarHues: ReadonlyMap<string, number> = new Map(),
  hiddenCategoryKeys: ReadonlySet<string> = new Set()
): ChronicleCanvasDrawResult {
  context.save();
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.fillStyle = theme.background;
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  const visibleYears = visibleChronicleCanvasYears(scene.periodScale, camera, viewportWidth);
  const visibleYearLabels = visibleChronicleCanvasYearLabels(visibleYears, camera);
  drawYearGuides(context, visibleYears, camera, viewportWidth, viewportHeight, theme, 1);
  const labelHits: ChronicleCanvasLabelHit[] = [];
  const baseCalendarName = calendarSettings?.baseCalendarName ?? defaultChronicleCalendarSettings.baseCalendarName;
  const visibleCalendarNames = new Set(calendarSettings?.visibleCalendarNames ?? [baseCalendarName]);
  const drawVisibleItem = (item: ChronicleCanvasItem): void => {
    if (hiddenCategoryKeys.has(chronicleEntryCategoryVisibilityKey(item.entry, baseCalendarName))) return;
    if (!isItemVisible(item, camera, viewportWidth, viewportHeight)) return;
    const hue = categoryHues.get(chronicleCategoryKey(item.entry.category));
    const itemColor = hue === undefined
      ? theme.mutedText
      : `hsl(${hue} ${theme.categorySaturation}% ${theme.categoryLightness}%)`;
    const hit = drawItem(
      context,
      item,
      itemColor,
      camera,
      item.id === hoveredItemId,
      hoveredPoint,
      viewportWidth,
      viewportHeight,
      theme
    );
    labelHits.push(hit);
  };
  for (const item of scene.items) {
    if (item.calendarName === baseCalendarName) drawVisibleItem(item);
  }
  if (calendarSettings) drawCalendarSurfaces(
    context,
    scene,
    visibleYearLabels,
    camera,
    viewportWidth,
    viewportHeight,
    theme,
    calendarSettings,
    visibleCalendarNames,
    calendarHues
  );
  for (const item of scene.items) {
    if (item.calendarName !== baseCalendarName && visibleCalendarNames.has(item.calendarName)) drawVisibleItem(item);
  }
  drawYearHeader(context, visibleYearLabels, camera, viewportWidth, theme, calendarSettings);
  context.restore();
  return { labelHits };
}

function drawYearGuides(
  context: CanvasRenderingContext2D,
  years: ChronicleCanvasYear[],
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  viewportHeight: number,
  theme: ChronicleCanvasTheme,
  rowCount: number
): void {
  const opacity = chronicleCanvasYearOpacity(camera.scale);
  const headerHeight = chronicleCanvasYearHeaderHeight(camera.scale, rowCount);
  context.save();
  context.globalAlpha = opacity * 0.12;
  context.strokeStyle = theme.mutedText;
  context.lineWidth = 1;

  for (const year of years) {
    const position = worldToCanvas({ x: year.x, y: 0 }, camera);
    if (position.x < -1 || position.x > viewportWidth + 1) continue;
    context.beginPath();
    context.moveTo(position.x, headerHeight);
    context.lineTo(position.x, viewportHeight);
    context.stroke();
  }
  context.restore();
}

function drawYearHeader(
  context: CanvasRenderingContext2D,
  years: ChronicleCanvasYear[],
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  theme: ChronicleCanvasTheme,
  calendarSettings?: ChronicleCalendarSettings
): void {
  const opacity = chronicleCanvasYearOpacity(camera.scale);
  const fontSize = chronicleCanvasYearFontSize(camera.scale);
  const calendarName = calendarSettings?.baseCalendarName ?? "";
  const headerHeight = chronicleCanvasYearHeaderHeight(camera.scale);
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = theme.background;
  context.fillRect(0, 0, viewportWidth, headerHeight);
  context.globalAlpha = opacity * 0.3;
  context.strokeStyle = theme.mutedText;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, headerHeight);
  context.lineTo(viewportWidth, headerHeight);
  context.stroke();

  context.font = `650 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.textAlign = "left";
  context.globalAlpha = opacity * 0.88;
  context.fillStyle = theme.mutedText;
  context.fillText(calendarName, 10, chronicleCanvasYearLabelY(camera.scale));
  context.textAlign = "center";
  for (const year of years) {
    const position = worldToCanvas({ x: year.x, y: 0 }, camera);
    position.y = chronicleCanvasYearLabelY(camera.scale);
    if (position.x < 58 || position.x > viewportWidth + 60) continue;
    context.globalAlpha = opacity * 0.88;
    context.fillStyle = theme.mutedText;
    context.fillText(formatYear(year.value), position.x, position.y);
  }
  context.restore();
}

function drawCalendarSurfaces(
  context: CanvasRenderingContext2D,
  scene: ChronicleCanvasScene,
  years: ChronicleCanvasYear[],
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  viewportHeight: number,
  theme: ChronicleCanvasTheme,
  calendarSettings: ChronicleCalendarSettings,
  visibleCalendarNames: ReadonlySet<string>,
  calendarHues: ReadonlyMap<string, number>
): void {
  for (const surface of scene.surfaces) {
    if (!visibleCalendarNames.has(surface.calendarName)) continue;
    const top = worldToCanvas({ x: 0, y: surface.y - surface.height / 2 }, camera).y;
    const height = surface.height * camera.scale;
    if (top > viewportHeight || top + height < chronicleCanvasYearHeaderHeight(camera.scale)) continue;
    const declaredStart = surface.startX === null ? 0 : worldToCanvas({ x: surface.startX, y: 0 }, camera).x;
    const declaredEnd = surface.endX === null ? viewportWidth : worldToCanvas({ x: surface.endX, y: 0 }, camera).x;
    const singleYearWidth = Math.max(18, 28 * Math.sqrt(camera.scale));
    const left = declaredStart === declaredEnd
      ? declaredStart - singleYearWidth / 2
      : Math.min(declaredStart, declaredEnd);
    const right = declaredStart === declaredEnd
      ? declaredEnd + singleYearWidth / 2
      : Math.max(declaredStart, declaredEnd);
    const contentStart = worldToCanvas({ x: surface.contentStartX, y: 0 }, camera).x;
    const contentEnd = worldToCanvas({ x: surface.contentEndX, y: 0 }, camera).x;
    const effectiveLeft = Math.min(left, contentStart);
    const effectiveRight = Math.max(right, contentEnd);
    if (effectiveRight < 0 || effectiveLeft > viewportWidth) continue;
    const clippedRect = (start: number, end: number): { left: number; width: number } | null => {
      const clippedLeft = Math.max(-2, Math.min(start, end));
      const clippedRight = Math.min(viewportWidth + 2, Math.max(start, end));
      return clippedRight > clippedLeft ? { left: clippedLeft, width: clippedRight - clippedLeft } : null;
    };
    const declaredRect = clippedRect(left, right);
    const hue = calendarHues.get(surface.calendarName);
    const surfaceColor = hue === undefined
      ? theme.mutedText
      : `hsl(${hue} ${theme.categorySaturation}% ${theme.categoryLightness}%)`;
    context.save();
    context.globalAlpha = 0.1;
    context.fillStyle = surfaceColor;
    if (declaredRect) context.fillRect(declaredRect.left, top, declaredRect.width, height);
    context.globalAlpha = 0.42;
    context.strokeStyle = surfaceColor;
    context.lineWidth = 1.5;
    if (surface.rangeState === "unset" && "setLineDash" in context) context.setLineDash([8, 6]);
    if (declaredRect) context.strokeRect(declaredRect.left, top, declaredRect.width, height);

    if (surface.rangeState === "overflow") {
      context.globalAlpha = 0.12;
      context.fillStyle = "#d97706";
      const leadingOverflow = contentStart < left ? clippedRect(contentStart, left) : null;
      const trailingOverflow = contentEnd > right ? clippedRect(right, contentEnd) : null;
      if (leadingOverflow) context.fillRect(leadingOverflow.left, top, leadingOverflow.width, height);
      if (trailingOverflow) context.fillRect(trailingOverflow.left, top, trailingOverflow.width, height);
      context.globalAlpha = 0.72;
      context.strokeStyle = "#d97706";
      if ("setLineDash" in context) context.setLineDash([6, 5]);
      if (leadingOverflow) context.strokeRect(leadingOverflow.left, top, leadingOverflow.width, height);
      if (trailingOverflow) context.strokeRect(trailingOverflow.left, top, trailingOverflow.width, height);
      if ("setLineDash" in context) context.setLineDash([]);
    }

    context.globalAlpha = 0.9;
    context.fillStyle = surfaceColor;
    context.font = "750 12px -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    const labelX = Math.min(Math.max(left + 10, 10), Math.max(10, Math.min(right - 10, viewportWidth - 120)));
    context.fillText(surface.calendarName, labelX, top + 18);
    context.font = "650 10px -apple-system, BlinkMacSystemFont, sans-serif";
    context.textAlign = "center";
    for (const year of years) {
      const x = worldToCanvas({ x: year.x, y: 0 }, camera).x;
      if (x < left + 56 || x > right || x < 0 || x > viewportWidth) continue;
      const converted = baseYearToCalendarYear(year.value, surface.calendarName, calendarSettings);
      if (converted === null) continue;
      context.globalAlpha = 0.72;
      context.fillStyle = surfaceColor;
      context.fillText(formatYear(converted), x, top + 18);
    }
    context.restore();
  }
}

function drawItem(
  context: CanvasRenderingContext2D,
  item: ChronicleCanvasItem,
  itemColor: string,
  camera: ChronicleCanvasCamera,
  hovered: boolean,
  hoveredPoint: ChronicleCanvasPoint | null,
  viewportWidth: number,
  viewportHeight: number,
  theme: ChronicleCanvasTheme
): ChronicleCanvasLabelHit {
  const anchorCenter = (item.startX + item.endX) / 2;
  const displacementX = item.x - anchorCenter;
  const start = worldToCanvas({ x: item.startX + displacementX, y: item.y }, camera);
  const end = worldToCanvas({ x: item.endX + displacementX, y: item.y }, camera);
  const radius = Math.max(3.5, Math.min(8, nodeRadius * Math.sqrt(camera.scale)));
  const baseOpacity = chronicleCanvasTextOpacity(camera.scale);
  const renderedOpacity = hovered ? Math.max(0.92, baseOpacity) : baseOpacity;
  const naturalCenterX = (start.x + end.x) / 2;
  const defaultLabelY = start.y - CHRONICLE_CANVAS_ITEM_LABEL_OFFSET;

  context.save();
  context.strokeStyle = itemColor;
  context.fillStyle = itemColor;
  context.lineCap = "round";
  context.lineWidth = hovered ? 3.5 : 2.5;
  context.globalAlpha = hovered ? 1 : 0.86;
  context.shadowColor = hovered ? itemColor : "transparent";
  context.shadowBlur = hovered ? hoveredItemGlowBlur : 0;
  if (item.startYear !== item.endYear) {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  drawNode(context, start.x, start.y, radius, itemColor, theme.background, hovered);
  if (item.startYear !== item.endYear) drawNode(context, end.x, end.y, radius, itemColor, theme.background, hovered);
  context.shadowColor = "transparent";
  context.shadowBlur = 0;

  context.globalAlpha = renderedOpacity;
  context.fillStyle = theme.text;
  const labelFontSize = hovered ? hoveredItemLabelFontSize : itemLabelFontSize;
  const itemNameFont = `750 ${labelFontSize}px ${itemLabelFontFamily}`;
  context.font = itemNameFont;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const measuredLabelWidth = hovered
    ? context.measureText(item.entry.fileName).width
    : item.labelTextWidth ?? (item.labelTextWidth = context.measureText(item.entry.fileName).width);
  context.font = itemRangeFont;
  const measuredRangeWidth = context.measureText(item.rangeLabel).width;
  const combinedLabelWidth = measuredLabelWidth + itemLabelGap + measuredRangeWidth;
  const hoveredLabel = hovered && hoveredPoint;
  const centerX = Math.max(
    combinedLabelWidth / 2 + 12,
    Math.min(viewportWidth - combinedLabelWidth / 2 - 12, hoveredLabel ? hoveredPoint.x : naturalCenterX)
  );
  const labelY = hoveredLabel
    ? Math.max(
      chronicleCanvasYearHeaderHeight(camera.scale) + 14,
      Math.min(viewportHeight - 24, hoveredPoint.y - CHRONICLE_CANVAS_ITEM_LABEL_OFFSET)
    )
    : defaultLabelY;
  const nameX = centerX - combinedLabelWidth / 2 + measuredLabelWidth / 2;
  const rangeX = centerX + combinedLabelWidth / 2 - measuredRangeWidth / 2;
  context.font = itemNameFont;
  context.fillText(item.entry.fileName, nameX, labelY);
  context.fillStyle = theme.mutedText;
  context.font = itemRangeFont;
  context.fillText(item.rangeLabel, rangeX, labelY);
  context.restore();

  return {
    height: CHRONICLE_CANVAS_LABEL_HEIGHT,
    itemId: item.id,
    opacity: baseOpacity,
    width: combinedLabelWidth + 12,
    x: centerX - combinedLabelWidth / 2 - 6,
    y: labelY - CHRONICLE_CANVAS_LABEL_HEIGHT / 2
  };
}

function drawNode(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  background: string,
  hovered: boolean
): void {
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fillStyle = hovered ? color : background;
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = hovered ? 3 : 2.4;
  context.stroke();
}

function isItemVisible(
  item: ChronicleCanvasItem,
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  viewportHeight: number
): boolean {
  const position = worldToCanvas({ x: item.x, y: item.y }, camera);
  const halfWidth = item.width * camera.scale / 2 + 120;
  const halfHeight = item.height * camera.scale / 2 + 60;
  return position.x + halfWidth >= 0 && position.x - halfWidth <= viewportWidth && position.y + halfHeight >= 0 && position.y - halfHeight <= viewportHeight;
}

function formatYear(year: number): string {
  return year < 0 ? `−${Math.abs(year)}` : String(year);
}
