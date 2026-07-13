import type { ChartEntry } from "../shared/ipc";

export const CHRONICLE_CANVAS_MIN_SCALE = 0.08;
export const CHRONICLE_CANVAS_MAX_SCALE = 2.4;
export const CHRONICLE_CANVAS_INITIAL_SCALE = 0.82;
export const CHRONICLE_CANVAS_LABEL_HEIGHT = 20;
export const CHRONICLE_CANVAS_ITEM_LABEL_OFFSET = 22;
const CHRONICLE_CANVAS_TEXT_FADE_START_SCALE = 0.04;
const CHRONICLE_CANVAS_TEXT_FADE_RANGE = 0.65;

const itemHeight = 70;
const labelCharacterWidth = 7.4;
const minimumYearGap = 62;
const yearGapScale = 48;
const springStrength = 0.2;
const damping = 0.72;

export interface ChronicleCanvasCamera {
  panX: number;
  panY: number;
  scale: number;
  targetScale: number;
  velocityX: number;
  velocityY: number;
}

export interface ChronicleCanvasItem {
  endX: number;
  endYear: number;
  entry: ChartEntry;
  height: number;
  homeY: number;
  id: string;
  labelWidth: number;
  labelTextWidth: number | null;
  rangeLabel: string;
  startX: number;
  startYear: number;
  vx: number;
  vy: number;
  width: number;
  x: number;
  y: number;
}

export interface ChronicleCanvasYear {
  value: number;
  x: number;
}

export interface ChronicleCanvasScene {
  items: ChronicleCanvasItem[];
  years: ChronicleCanvasYear[];
}

export interface ChronicleCanvasLabelHit {
  height: number;
  itemId: string;
  opacity: number;
  width: number;
  x: number;
  y: number;
}

export interface ChronicleCanvasPoint {
  x: number;
  y: number;
}

export function createChronicleCanvasCamera(): ChronicleCanvasCamera {
  return {
    panX: 0,
    panY: 0,
    scale: CHRONICLE_CANVAS_INITIAL_SCALE,
    targetScale: CHRONICLE_CANVAS_INITIAL_SCALE,
    velocityX: 0,
    velocityY: 0
  };
}

export function createChronicleCanvasScene(
  entries: ChartEntry[],
  random: () => number = Math.random
): ChronicleCanvasScene {
  const years = buildChronicleCanvasYears(entries);
  const xByYear = new Map(years.map((year) => [year.value, year.x]));
  const verticalSlots = entries.map((_, index) => (index - (entries.length - 1) / 2) * (itemHeight + 24));
  for (let index = verticalSlots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [verticalSlots[index], verticalSlots[swapIndex]] = [verticalSlots[swapIndex], verticalSlots[index]];
  }
  const items = entries.map((entry, index) => {
    const startYear = entry.startPoint.year;
    const endYear = entry.endPoint.year;
    const startX = xByYear.get(startYear) ?? 0;
    const endX = xByYear.get(endYear) ?? startX;
    const rangeLabel = formatRange(entry);
    const labelWidth = Math.max(48, entry.fileName.length * labelCharacterWidth + 18);
    const width = Math.max(24, Math.abs(endX - startX));
    const centerX = (startX + endX) / 2;
    const initialY = verticalSlots[index] + (random() - 0.5) * 12;

    return {
      endX,
      endYear,
      entry,
      height: itemHeight,
      homeY: initialY,
      id: entryKey(entry),
      labelWidth,
      labelTextWidth: null,
      rangeLabel,
      startX,
      startYear,
      vx: 0,
      vy: 0,
      width: Math.max(width, labelWidth),
      x: centerX,
      y: initialY
    } satisfies ChronicleCanvasItem;
  });

  settleChronicleCanvasScene(items, 240);
  for (const item of items) item.homeY = item.y;
  return { items, years };
}

export function buildChronicleCanvasYears(entries: ChartEntry[]): ChronicleCanvasYear[] {
  const values = [...new Set(entries.flatMap((entry) => [entry.startPoint.year, entry.endPoint.year]))]
    .sort((a, b) => a - b);
  let x = 0;

  return values.map((value, index) => {
    if (index > 0) {
      const yearDifference = Math.max(1, value - values[index - 1]);
      x += compressedYearDistance(yearDifference);
    }
    return { value, x };
  });
}

export function compressedYearDistance(yearDifference: number): number {
  return minimumYearGap + Math.log1p(Math.max(0, yearDifference - 1)) * yearGapScale;
}

export function settleChronicleCanvasScene(items: ChronicleCanvasItem[], iterations: number): void {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (!stepChronicleCanvasScene(items, null, 1 / 60)) break;
  }
  for (const item of items) {
    item.vx = 0;
    item.vy = 0;
  }
}

export function stepChronicleCanvasScene(
  items: ChronicleCanvasItem[],
  draggedItemId: string | null,
  deltaSeconds: number
): boolean {
  const frameScale = Math.min(2, Math.max(0.25, deltaSeconds * 60));
  let moving = false;

  const verticalOrder = items.length > 24 ? items.toSorted((left, right) => left.y - right.y) : items;
  const maximumItemHeight = items.reduce((maximum, item) => Math.max(maximum, item.height), 0);
  for (let leftIndex = 0; leftIndex < verticalOrder.length; leftIndex += 1) {
    const left = verticalOrder[leftIndex];
    const maximumVerticalDistance = (left.height + maximumItemHeight) / 2 + 12;
    for (let rightIndex = leftIndex + 1; rightIndex < verticalOrder.length; rightIndex += 1) {
      const right = verticalOrder[rightIndex];
      if (right.y - left.y > maximumVerticalDistance) break;
      applyItemRepulsion(left, right, frameScale);
    }
  }

  for (const item of items) {
    if (item.id !== draggedItemId) {
      const anchorX = (item.startX + item.endX) / 2;
      item.vx += (anchorX - item.x) * springStrength * frameScale;
      item.vy += (item.homeY - item.y) * springStrength * frameScale;
    }

    item.vx *= Math.pow(damping, frameScale);
    item.vy *= Math.pow(damping, frameScale);
    if (item.id !== draggedItemId) {
      item.x += item.vx * frameScale;
      item.y += item.vy * frameScale;
    }
    moving ||= Math.abs(item.vx) + Math.abs(item.vy) > 0.02;
  }

  return moving;
}

function applyItemRepulsion(
  left: ChronicleCanvasItem,
  right: ChronicleCanvasItem,
  frameScale: number
): void {
  const requiredX = (left.width + right.width) / 2 + 22;
  const requiredY = (left.height + right.height) / 2 + 12;
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  const overlapX = requiredX - Math.abs(dx);
  const overlapY = requiredY - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return;

  const directionY = dy === 0 ? (left.id < right.id ? 1 : -1) : Math.sign(dy);
  const force = Math.min(6, overlapY * 0.045) * frameScale;
  left.vy -= directionY * force;
  right.vy += directionY * force;
}

export function initializeChronicleCanvasCamera(
  camera: ChronicleCanvasCamera,
  scene: ChronicleCanvasScene,
  viewportWidth: number,
  viewportHeight: number
): void {
  const ordered = scene.items.toSorted((a, b) => a.startYear - b.startYear || a.endYear - b.endYear);
  const median = ordered[Math.floor(ordered.length / 2)];
  const centerX = median ? (median.startX + median.endX) / 2 : 0;
  camera.scale = CHRONICLE_CANVAS_INITIAL_SCALE;
  camera.targetScale = CHRONICLE_CANVAS_INITIAL_SCALE;
  camera.panX = viewportWidth / 2 - centerX * camera.scale;
  camera.panY = viewportHeight / 2 - (median?.y ?? 0) * camera.scale;
  camera.velocityX = 0;
  camera.velocityY = 0;
}

export function worldToCanvas(point: ChronicleCanvasPoint, camera: ChronicleCanvasCamera): ChronicleCanvasPoint {
  return {
    x: point.x * camera.scale + camera.panX,
    y: point.y * camera.scale + camera.panY
  };
}

export function canvasToWorld(point: ChronicleCanvasPoint, camera: ChronicleCanvasCamera): ChronicleCanvasPoint {
  return {
    x: (point.x - camera.panX) / camera.scale,
    y: (point.y - camera.panY) / camera.scale
  };
}

export function zoomChronicleCanvasAtPoint(
  camera: ChronicleCanvasCamera,
  nextScale: number,
  point: ChronicleCanvasPoint
): void {
  const clampedScale = Math.min(CHRONICLE_CANVAS_MAX_SCALE, Math.max(CHRONICLE_CANVAS_MIN_SCALE, nextScale));
  const worldPoint = canvasToWorld(point, camera);
  camera.targetScale = clampedScale;
  camera.scale = clampedScale;
  camera.panX = point.x - worldPoint.x * clampedScale;
  camera.panY = point.y - worldPoint.y * clampedScale;
}

export function chronicleCanvasTextOpacity(scale: number): number {
  if (scale <= CHRONICLE_CANVAS_MIN_SCALE) return 0;
  const progress = (scale - CHRONICLE_CANVAS_TEXT_FADE_START_SCALE) / CHRONICLE_CANVAS_TEXT_FADE_RANGE;
  return smoothstep(Math.min(1, Math.max(0, progress)));
}

export function chronicleCanvasYearOpacity(scale: number): number {
  return Math.max(0.5, chronicleCanvasTextOpacity(scale));
}

export function chronicleCanvasYearFontSize(scale: number): number {
  return Math.min(18, Math.max(9, 11 * Math.sqrt(scale / CHRONICLE_CANVAS_INITIAL_SCALE)));
}

export function chronicleCanvasYearLabelY(scale: number): number {
  return Math.max(22, chronicleCanvasYearFontSize(scale) + 14);
}

export function chronicleCanvasYearHeaderHeight(scale: number): number {
  const yearFontSize = chronicleCanvasYearFontSize(scale);
  return Math.ceil(chronicleCanvasYearLabelY(scale) + yearFontSize / 2 + 16);
}

export function visibleChronicleCanvasYears(
  years: ChronicleCanvasYear[],
  camera: ChronicleCanvasCamera,
  minimumScreenGap = 64,
  viewportWidth?: number
): ChronicleCanvasYear[] {
  const visible: ChronicleCanvasYear[] = [];
  let previousScreenX = -Infinity;
  const range = viewportWidth === undefined
    ? { end: years.length, start: 0 }
    : visibleYearRange(years, camera, viewportWidth, minimumScreenGap);
  for (let index = range.start; index < range.end; index += 1) {
    const year = years[index];
    const screenX = year.x * camera.scale + camera.panX;
    if (screenX - previousScreenX < minimumScreenGap) continue;
    visible.push(year);
    previousScreenX = screenX;
  }
  return visible;
}

function visibleYearRange(
  years: ChronicleCanvasYear[],
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  overscan: number
): { end: number; start: number } {
  if (years.length === 0 || camera.scale <= 0) return { end: 0, start: 0 };

  const minimumWorldX = (-overscan - camera.panX) / camera.scale;
  const maximumWorldX = (viewportWidth + overscan - camera.panX) / camera.scale;
  return {
    end: upperBoundYearX(years, maximumWorldX),
    start: lowerBoundYearX(years, minimumWorldX)
  };
}

function lowerBoundYearX(years: ChronicleCanvasYear[], target: number): number {
  let low = 0;
  let high = years.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (years[middle].x < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function upperBoundYearX(years: ChronicleCanvasYear[], target: number): number {
  let low = 0;
  let high = years.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (years[middle].x <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function chronicleCanvasItemAtPoint(
  items: ChronicleCanvasItem[],
  camera: ChronicleCanvasCamera,
  point: ChronicleCanvasPoint
): ChronicleCanvasItem | null {
  const world = canvasToWorld(point, camera);
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const halfWidth = Math.max(item.width / 2, 18 / camera.scale);
    const halfHeight = Math.max(item.height / 2, 18 / camera.scale);
    if (Math.abs(world.x - item.x) <= halfWidth && Math.abs(world.y - item.y) <= halfHeight) return item;
  }
  return null;
}

export function chronicleCanvasPointerItemAtPoint(
  items: ChronicleCanvasItem[],
  camera: ChronicleCanvasCamera,
  point: ChronicleCanvasPoint
): ChronicleCanvasItem | null {
  return point.y < chronicleCanvasYearHeaderHeight(camera.scale)
    ? null
    : chronicleCanvasItemAtPoint(items, camera, point);
}

export function chronicleCanvasClickPath(item: ChronicleCanvasItem | null, moved: boolean): string | null {
  return item && !moved ? item.entry.path : null;
}

export function chronicleCanvasPointerMovedBeyondClickThreshold(
  start: ChronicleCanvasPoint,
  current: ChronicleCanvasPoint
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) >= 4;
}

export function prepareChronicleCanvasPointerCancel(
  camera: ChronicleCanvasCamera,
  item: ChronicleCanvasItem | null,
  moved: boolean
): boolean {
  camera.velocityX = 0;
  camera.velocityY = 0;
  if (!item) return false;

  item.vx = 0;
  item.vy = 0;
  return moved;
}

export function chronicleCanvasLabelAtPoint(
  hits: ChronicleCanvasLabelHit[],
  point: ChronicleCanvasPoint,
  minimumOpacity = 0.72
): ChronicleCanvasLabelHit | null {
  for (let index = hits.length - 1; index >= 0; index -= 1) {
    const hit = hits[index];
    if (hit.opacity < minimumOpacity) continue;
    if (point.x >= hit.x && point.x <= hit.x + hit.width && point.y >= hit.y && point.y <= hit.y + hit.height) return hit;
  }
  return null;
}

export function stepChronicleCanvasInertia(camera: ChronicleCanvasCamera): boolean {
  camera.panX += camera.velocityX;
  camera.panY += camera.velocityY;
  camera.velocityX *= 0.9;
  camera.velocityY *= 0.9;
  if (Math.abs(camera.velocityX) < 0.05) camera.velocityX = 0;
  if (Math.abs(camera.velocityY) < 0.05) camera.velocityY = 0;
  return camera.velocityX !== 0 || camera.velocityY !== 0;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function formatRange(entry: ChartEntry): string {
  const startLabel = chronicleLabelWithoutCalendarName(entry.startLabel, entry.chronicleCalendarName);
  const endLabel = chronicleLabelWithoutCalendarName(entry.endLabel, entry.chronicleCalendarName);
  return entry.startValue === entry.endValue ? startLabel : `${startLabel} 〜 ${endLabel}`;
}

function chronicleLabelWithoutCalendarName(label: string, calendarName: string | undefined): string {
  const name = calendarName?.trim();
  if (!name) return label;

  const trimmed = label.trim();
  return trimmed.startsWith(`${name} `) ? trimmed.slice(name.length + 1) : trimmed;
}

function entryKey(entry: ChartEntry): string {
  return `${entry.path}:chronicle:${entry.chronicleEntryIndex}`;
}
