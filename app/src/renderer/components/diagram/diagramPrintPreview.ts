import {
  type RelicConnectedDiagramDocument,
  type RelicDiagramPrintArea,
  type RelicDiagramPrintSettings
} from "../../../shared/diagramMarkdown";
import {
  buildDiagramCanvasLayout,
  type DiagramCanvasLayout
} from "./diagramGeometry";
import { diagramGridSize } from "./diagramSnap";

const cssPixelsPerMillimeter = 96 / 25.4;

const paperSizeMm: Record<RelicDiagramPrintSettings["paperSize"], { height: number; width: number }> = {
  A3: { height: 420, width: 297 },
  A4: { height: 297, width: 210 },
  Legal: { height: 355.6, width: 215.9 },
  Letter: { height: 279.4, width: 215.9 }
};

const marginPresetMm: Record<RelicDiagramPrintSettings["marginPreset"], number> = {
  large: 20,
  none: 0,
  normal: 12.7,
  small: 6
};

export interface DiagramPrintPreviewPage {
  contentHeight: number;
  contentWidth: number;
  contentX: number;
  contentY: number;
  label: string;
  paperHeight: number;
  paperWidth: number;
  paperX: number;
  paperY: number;
}

export interface DiagramPrintPreviewLayout {
  marginPx: number;
  pages: DiagramPrintPreviewPage[];
  paperHeightPx: number;
  paperWidthPx: number;
  scale: number;
  usablePaperHeightPx: number;
  usablePaperWidthPx: number;
}

export function buildDiagramPrintPreviewLayout(
  printArea: RelicDiagramPrintArea,
  settings: RelicDiagramPrintSettings
): DiagramPrintPreviewLayout {
  const normalizedPrintArea = normalizeDiagramPrintAreaToGrid(printArea);
  const paper = paperDimensions(settings);
  const marginPx = marginPresetMm[settings.marginPreset] * cssPixelsPerMillimeter;
  const usablePaperWidth = Math.max(1, paper.width - marginPx * 2);
  const usablePaperHeight = Math.max(1, paper.height - marginPx * 2);
  const scale = printPreviewScale(normalizedPrintArea, settings, usablePaperWidth, usablePaperHeight);
  const pageContentWidth = settings.scaleMode === "width" || settings.scaleMode === "fit"
    ? normalizedPrintArea.width
    : Math.max(1, usablePaperWidth / scale);
  const pageContentHeight = settings.scaleMode === "fit"
    ? normalizedPrintArea.height
    : Math.max(1, usablePaperHeight / scale);
  const marginInCanvasUnits = marginPx / scale;
  const paperWidth = paper.width / scale;
  const paperHeight = paper.height / scale;
  const columns = Math.max(1, Math.ceil(normalizedPrintArea.width / pageContentWidth));
  const rows = Math.max(1, Math.ceil(normalizedPrintArea.height / pageContentHeight));
  const pages: DiagramPrintPreviewPage[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const contentX = normalizedPrintArea.x + column * pageContentWidth;
      const contentY = normalizedPrintArea.y + row * pageContentHeight;
      pages.push({
        contentHeight: Math.min(pageContentHeight, normalizedPrintArea.y + normalizedPrintArea.height - contentY),
        contentWidth: Math.min(pageContentWidth, normalizedPrintArea.x + normalizedPrintArea.width - contentX),
        contentX,
        contentY,
        label: String(row * columns + column + 1),
        paperHeight,
        paperWidth,
        paperX: contentX - marginInCanvasUnits,
        paperY: contentY - marginInCanvasUnits
      });
    }
  }

  return {
    marginPx,
    pages,
    paperHeightPx: paper.height,
    paperWidthPx: paper.width,
    scale,
    usablePaperHeightPx: usablePaperHeight,
    usablePaperWidthPx: usablePaperWidth
  };
}

export function resolveDiagramPrintArea(
  diagram: RelicConnectedDiagramDocument,
  settings: RelicDiagramPrintSettings
): RelicDiagramPrintArea {
  if (diagram.printArea) return normalizeDiagramPrintAreaToGrid(diagram.printArea);
  return buildAutomaticDiagramPrintArea(diagram, settings);
}

export function buildAutomaticDiagramPrintArea(
  diagram: RelicConnectedDiagramDocument,
  settings: RelicDiagramPrintSettings
): RelicDiagramPrintArea {
  const layout = buildDiagramCanvasLayout(diagram);
  if (layout.nodes.length === 0) return emptyDiagramPrintArea(settings);

  const bounds = diagramContentBounds(layout);
  const padded = {
    bottom: bounds.bottom + diagramGridSize,
    left: bounds.left - diagramGridSize,
    right: bounds.right + diagramGridSize,
    top: bounds.top - diagramGridSize
  };

  return normalizeDiagramPrintAreaToGrid({
    height: padded.bottom - padded.top,
    width: padded.right - padded.left,
    x: padded.left,
    y: padded.top
  });
}

export function normalizeDiagramPrintAreaToGrid(printArea: RelicDiagramPrintArea): RelicDiagramPrintArea {
  const left = floorToGrid(printArea.x);
  const top = floorToGrid(printArea.y);
  const right = ceilToGrid(printArea.x + Math.max(diagramGridSize, printArea.width));
  const bottom = ceilToGrid(printArea.y + Math.max(diagramGridSize, printArea.height));

  return {
    height: Math.max(diagramGridSize * 2, bottom - top),
    width: Math.max(diagramGridSize * 2, right - left),
    x: left,
    y: top
  };
}

export function moveDiagramPrintAreaToGrid(
  printArea: RelicDiagramPrintArea,
  deltaX: number,
  deltaY: number
): RelicDiagramPrintArea {
  return {
    ...printArea,
    x: Math.round((printArea.x + deltaX) / diagramGridSize) * diagramGridSize,
    y: Math.round((printArea.y + deltaY) / diagramGridSize) * diagramGridSize
  };
}

export function resizeDiagramPrintAreaToGrid(
  printArea: RelicDiagramPrintArea,
  edge: "bottom" | "left" | "right" | "top",
  deltaX: number,
  deltaY: number
): RelicDiagramPrintArea {
  const minSize = diagramGridSize * 2;
  const left = printArea.x;
  const top = printArea.y;
  const right = printArea.x + printArea.width;
  const bottom = printArea.y + printArea.height;

  if (edge === "left") {
    const nextLeft = Math.min(right - minSize, Math.round((left + deltaX) / diagramGridSize) * diagramGridSize);
    return { height: printArea.height, width: right - nextLeft, x: nextLeft, y: printArea.y };
  }
  if (edge === "top") {
    const nextTop = Math.min(bottom - minSize, Math.round((top + deltaY) / diagramGridSize) * diagramGridSize);
    return { height: bottom - nextTop, width: printArea.width, x: printArea.x, y: nextTop };
  }
  if (edge === "right") {
    const nextRight = Math.max(left + minSize, Math.round((right + deltaX) / diagramGridSize) * diagramGridSize);
    return { height: printArea.height, width: nextRight - left, x: printArea.x, y: printArea.y };
  }

  const nextBottom = Math.max(top + minSize, Math.round((bottom + deltaY) / diagramGridSize) * diagramGridSize);
  return { height: nextBottom - top, width: printArea.width, x: printArea.x, y: printArea.y };
}

export function paperDimensions(settings: RelicDiagramPrintSettings): { height: number; width: number } {
  const size = paperSizeMm[settings.paperSize];
  const widthMm = settings.orientation === "landscape" ? size.height : size.width;
  const heightMm = settings.orientation === "landscape" ? size.width : size.height;
  return {
    height: heightMm * cssPixelsPerMillimeter,
    width: widthMm * cssPixelsPerMillimeter
  };
}

function diagramContentBounds(layout: DiagramCanvasLayout): { bottom: number; left: number; right: number; top: number } {
  const nodeBounds = layout.nodes.map(({ node }) => ({
    bottom: node.y + node.height,
    left: node.x,
    right: node.x + node.width,
    top: node.y
  }));
  const lineBounds = layout.lines.map((line) => ({
    bottom: Math.max(line.y1, line.y2, line.labelY + diagramGridSize),
    left: Math.min(line.x1, line.x2, line.labelX - diagramGridSize),
    right: Math.max(line.x1, line.x2, line.labelX + diagramGridSize),
    top: Math.min(line.y1, line.y2, line.labelY - diagramGridSize)
  }));
  const bounds = [...nodeBounds, ...lineBounds];

  return {
    bottom: Math.max(...bounds.map((bound) => bound.bottom)),
    left: Math.min(...bounds.map((bound) => bound.left)),
    right: Math.max(...bounds.map((bound) => bound.right)),
    top: Math.min(...bounds.map((bound) => bound.top))
  };
}

function emptyDiagramPrintArea(settings: RelicDiagramPrintSettings): RelicDiagramPrintArea {
  const paper = paperDimensions(settings);
  const marginPx = marginPresetMm[settings.marginPreset] * cssPixelsPerMillimeter;
  const usablePaperWidth = Math.max(diagramGridSize * 2, paper.width - marginPx * 2);
  const usablePaperHeight = Math.max(diagramGridSize * 2, paper.height - marginPx * 2);
  const scale = settings.scaleMode === "actual" ? Math.max(0.1, settings.scale) : 1;

  return normalizeDiagramPrintAreaToGrid({
    height: usablePaperHeight / scale,
    width: usablePaperWidth / scale,
    x: 0,
    y: 0
  });
}

function floorToGrid(value: number): number {
  return Math.floor(value / diagramGridSize) * diagramGridSize;
}

function ceilToGrid(value: number): number {
  return Math.ceil(value / diagramGridSize) * diagramGridSize;
}

function printPreviewScale(
  printArea: RelicDiagramPrintArea,
  settings: RelicDiagramPrintSettings,
  usablePaperWidth: number,
  usablePaperHeight: number
): number {
  if (settings.scaleMode === "actual") return clampPrintScale(settings.scale);
  if (settings.scaleMode === "width") return clampPrintScale(usablePaperWidth / printArea.width);

  return clampPrintScale(
    Math.min(usablePaperWidth / printArea.width, usablePaperHeight / printArea.height)
  );
}

function clampPrintScale(scale: number): number {
  return Math.max(0.1, Math.min(2, scale));
}
