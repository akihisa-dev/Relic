import {
  chronicleCanvasTextOpacity,
  visibleChronicleCanvasYears,
  worldToCanvas,
  type ChronicleCanvasCamera,
  type ChronicleCanvasItem,
  type ChronicleCanvasLabelHit,
  type ChronicleCanvasScene
} from "./chronicleCanvasModel";

const nodeRadius = 6;
const labelHeight = 20;

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
  drawYears(context, scene, camera, viewportWidth, theme);

  const labelHits: ChronicleCanvasLabelHit[] = [];
  for (const item of scene.items) {
    if (!isItemVisible(item, camera, viewportWidth, viewportHeight)) continue;
    const hit = drawItem(context, item, camera, item.id === hoveredItemId, viewportWidth, theme);
    labelHits.push(hit);
  }
  context.restore();
  return { labelHits };
}

function drawYears(
  context: CanvasRenderingContext2D,
  scene: ChronicleCanvasScene,
  camera: ChronicleCanvasCamera,
  viewportWidth: number,
  theme: ChronicleCanvasTheme
): void {
  const opacity = chronicleCanvasTextOpacity(camera.scale);
  if (opacity <= 0.015) return;
  const years = visibleChronicleCanvasYears(scene.years, camera);
  context.save();
  context.font = "650 11px -apple-system, BlinkMacSystemFont, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const year of years) {
    const position = worldToCanvas({ x: year.x, y: 0 }, camera);
    position.y = 28;
    if (position.x < -60 || position.x > viewportWidth + 60) continue;
    context.globalAlpha = opacity * 0.72;
    context.fillStyle = theme.mutedText;
    context.fillText(formatYear(year.value), position.x, position.y);
    context.globalAlpha = opacity * 0.22;
    context.strokeStyle = theme.mutedText;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(position.x, position.y + 12);
    context.lineTo(position.x, position.y + 24);
    context.stroke();
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
  const labelY = start.y - 22;
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
    height: labelHeight,
    itemId: item.id,
    opacity: baseOpacity,
    width: measuredLabelWidth + 12,
    x: centerX - measuredLabelWidth / 2 - 6,
    y: labelY - labelHeight / 2
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
