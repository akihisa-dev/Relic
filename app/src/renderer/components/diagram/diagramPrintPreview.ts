import {
  type RelicDiagramPrintArea,
  type RelicDiagramPrintSettings
} from "../../../shared/diagramMarkdown";

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
  pages: DiagramPrintPreviewPage[];
}

export function buildDiagramPrintPreviewLayout(
  printArea: RelicDiagramPrintArea,
  settings: RelicDiagramPrintSettings
): DiagramPrintPreviewLayout {
  const paper = paperDimensions(settings);
  const marginPx = marginPresetMm[settings.marginPreset] * cssPixelsPerMillimeter;
  const usablePaperWidth = Math.max(1, paper.width - marginPx * 2);
  const usablePaperHeight = Math.max(1, paper.height - marginPx * 2);
  const scale = printPreviewScale(printArea, settings, usablePaperWidth, usablePaperHeight);
  const pageContentWidth = settings.scaleMode === "width"
    ? printArea.width
    : Math.max(1, usablePaperWidth / scale);
  const pageContentHeight = Math.max(1, usablePaperHeight / scale);
  const marginInCanvasUnits = marginPx / scale;
  const paperWidth = paper.width / scale;
  const paperHeight = paper.height / scale;
  const columns = Math.max(1, Math.ceil(printArea.width / pageContentWidth));
  const rows = Math.max(1, Math.ceil(printArea.height / pageContentHeight));
  const pages: DiagramPrintPreviewPage[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const contentX = printArea.x + column * pageContentWidth;
      const contentY = printArea.y + row * pageContentHeight;
      pages.push({
        contentHeight: Math.min(pageContentHeight, printArea.y + printArea.height - contentY),
        contentWidth: Math.min(pageContentWidth, printArea.x + printArea.width - contentX),
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

  return { pages };
}

function paperDimensions(settings: RelicDiagramPrintSettings): { height: number; width: number } {
  const size = paperSizeMm[settings.paperSize];
  const widthMm = settings.orientation === "landscape" ? size.height : size.width;
  const heightMm = settings.orientation === "landscape" ? size.width : size.height;
  return {
    height: heightMm * cssPixelsPerMillimeter,
    width: widthMm * cssPixelsPerMillimeter
  };
}

function printPreviewScale(
  printArea: RelicDiagramPrintArea,
  settings: RelicDiagramPrintSettings,
  usablePaperWidth: number,
  usablePaperHeight: number
): number {
  if (settings.scaleMode === "actual") return Math.max(0.1, settings.scale);
  if (settings.scaleMode === "width") return Math.max(0.1, usablePaperWidth / printArea.width);

  return Math.max(
    0.1,
    Math.min(usablePaperWidth / printArea.width, usablePaperHeight / printArea.height)
  );
}
