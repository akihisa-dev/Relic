import {
  CHRONICLE_CANVAS_ITEM_LABEL_OFFSET,
  CHRONICLE_CANVAS_LABEL_HEIGHT,
  chronicleCanvasTextOpacity,
  chronicleCanvasYearHeaderHeight,
  chronicleCanvasYearLabelY,
  chronicleCanvasYearFontSize,
  chronicleCanvasYearOpacity,
  visibleChronicleCanvasYears,
  worldToCanvas,
  type ChronicleCanvasCamera,
  type ChronicleCanvasItem,
  type ChronicleCanvasLabelHit,
  type ChronicleCanvasScene
} from "./chronicleCanvasModel";

const nodeRadius = 6;

export interface ChronicleCanvasTheme {
  background: string;
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
  viewportWidth: number,
  viewportHeight: number,
  theme: ChronicleCanvasTheme
): ChronicleCanvasDrawResult {
  context.save();
  context.clearRect(0, 0, viewportWidth, viewportHeight);
  context.fillStyle = theme.background;
  context.fillRect(0, 0, viewportWidth, viewportHeight);

  drawYearGuides(context, scene, camera, viewportWidth, viewportHeight, theme);
  const labelHits: ChronicleCanvasLabelHit[] = [];
  for (const item of scene.items) {
    if (!isItemVisible(item, camera, viewportWidth, viewportHeight)) continue;
    const hit = drawItem(context, item, camera, item.id === hoveredItemId, viewportWidth, theme);
    labelHits.push(hit);
  }
  drawYearHeader(context, scene, camera, viewportWidth, theme);
  context.restore();
  return { labelHits };
}

function drawYearGuides(
  context: CanvasRenderingContext2D,
  scene: ChronicleCanvasScene,
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  viewportHeight: number,
  theme: ChronicleCanvasTheme
): void {
  const opacity = chronicleCanvasYearOpacity(camera.scale);
  const years = visibleChronicleCanvasYears(scene.years, camera);
  const headerHeight = chronicleCanvasYearHeaderHeight(camera.scale);
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
  scene: ChronicleCanvasScene,
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  theme: ChronicleCanvasTheme
): void {
  const opacity = chronicleCanvasYearOpacity(camera.scale);
  const years = visibleChronicleCanvasYears(scene.years, camera);
  const fontSize = chronicleCanvasYearFontSize(camera.scale);
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

  for (const year of years) {
    const position = worldToCanvas({ x: year.x, y: 0 }, camera);
    position.y = chronicleCanvasYearLabelY(camera.scale);
    if (position.x < -60 || position.x > viewportWidth + 60) continue;
    context.globalAlpha = opacity * 0.88;
    context.fillStyle = theme.mutedText;
    context.fillText(formatYear(year.value), position.x, position.y);
  }
  context.restore();
}

function drawItem(
  context: CanvasRenderingContext2D,
  item: ChronicleCanvasItem,
  camera: ChronicleCanvasCamera,
  hovered: boolean,
  viewportWidth: number,
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
  const labelY = start.y - CHRONICLE_CANVAS_ITEM_LABEL_OFFSET;
  const rangeY = start.y + 24;

  context.save();
  context.strokeStyle = item.color;
  context.fillStyle = item.color;
  context.lineCap = "round";
  context.lineWidth = hovered ? 3.5 : 2.5;
  context.globalAlpha = hovered ? 1 : 0.86;
  if (item.startYear !== item.endYear) {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  drawNode(context, start.x, start.y, radius, item.color, theme.background, hovered);
  if (item.startYear !== item.endYear) drawNode(context, end.x, end.y, radius, item.color, theme.background, hovered);

  context.globalAlpha = renderedOpacity;
  context.fillStyle = theme.text;
  context.font = "750 12px -apple-system, BlinkMacSystemFont, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const measuredLabelWidth = item.labelTextWidth ?? (item.labelTextWidth = context.measureText(item.entry.fileName).width);
  const centerX = Math.max(measuredLabelWidth / 2 + 12, Math.min(viewportWidth - measuredLabelWidth / 2 - 12, naturalCenterX));
  context.fillText(item.entry.fileName, centerX, labelY);
  context.fillStyle = theme.mutedText;
  context.font = "650 11px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(item.rangeLabel, centerX, rangeY);
  context.restore();

  return {
    height: CHRONICLE_CANVAS_LABEL_HEIGHT,
    itemId: item.id,
    opacity: baseOpacity,
    width: measuredLabelWidth + 12,
    x: centerX - measuredLabelWidth / 2 - 6,
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
