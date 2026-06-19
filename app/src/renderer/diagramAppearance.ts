import type {
  RelicConnectedDiagramNode,
  RelicDiagramLine,
  RelicDiagramNodeColorPreset,
  RelicDiagramPrintMarginPreset,
  RelicDiagramPrintOrientation,
  RelicDiagramPrintSettings,
  RelicDiagramTextSize,
  RelicDiagramVerticalAlignment
} from "../shared/diagramMarkdown";

interface DiagramColorTokens {
  border: string;
  fill: string;
  text: string;
}

const nodeColorTokens: Record<RelicDiagramNodeColorPreset, DiagramColorTokens> = {
  blue: { border: "#3261a1", fill: "#d8e6f7", text: "#102a4c" },
  gray: { border: "#6f7885", fill: "#e6e8eb", text: "#202832" },
  green: { border: "#287a54", fill: "#d8eee2", text: "#143d2b" },
  red: { border: "#b43b34", fill: "#f6ddda", text: "#54201c" },
  yellow: { border: "#9b6b12", fill: "#f7e8bd", text: "#4a3309" }
};

const textSizePx: Record<RelicDiagramTextSize, number> = {
  large: 16,
  normal: 14,
  small: 12
};

const marginPresetMm: Record<RelicDiagramPrintMarginPreset, number> = {
  large: 20,
  none: 0,
  normal: 12.7,
  small: 6
};

const paperSizeCss: Record<RelicDiagramPrintSettings["paperSize"], string> = {
  A3: "A3",
  A4: "A4",
  Legal: "Legal",
  Letter: "Letter"
};

export function diagramNodeColorTokens(node: RelicConnectedDiagramNode): DiagramColorTokens | null {
  return node.color ? nodeColorTokens[node.color] : null;
}

export function diagramNodeFillColor(node: RelicConnectedDiagramNode): string | null {
  const tokens = diagramNodeColorTokens(node);
  if (!tokens) return null;
  if (node.shape === "area") return colorWithAlpha(tokens.fill, 0.42);
  return tokens.fill;
}

export function diagramNodeBorderColor(node: RelicConnectedDiagramNode): string | null {
  return diagramNodeColorTokens(node)?.border ?? null;
}

export function diagramNodeTextColor(node: RelicConnectedDiagramNode): string | null {
  return diagramNodeColorTokens(node)?.text ?? null;
}

export function diagramNodeFontSize(node: RelicConnectedDiagramNode): string {
  return `${textSizePx[node.textSize ?? (node.shape === "area" ? "small" : "normal")]}px`;
}

export function diagramLineLabelFontSize(line: RelicDiagramLine): string {
  return `${textSizePx[line.labelTextSize ?? "small"]}px`;
}

export function diagramNodeAlignItems(verticalAlign: RelicDiagramVerticalAlignment | undefined): string {
  if (verticalAlign === "bottom") return "end";
  if (verticalAlign === "top") return "start";
  return "center";
}

export function diagramNodeJustifyItems(textAlign: RelicConnectedDiagramNode["textAlign"]): string {
  if (textAlign === "left") return "start";
  if (textAlign === "right") return "end";
  return "center";
}

export function diagramPrintCss(settings: RelicDiagramPrintSettings): string {
  const margin = marginPresetMm[settings.marginPreset];
  const orientation: RelicDiagramPrintOrientation = settings.orientation;
  return `@page { margin: ${margin}mm; size: ${paperSizeCss[settings.paperSize]} ${orientation}; }`;
}

export function diagramScaleFactor(settings: RelicDiagramPrintSettings): number {
  return settings.scaleMode === "actual" ? settings.scale : 1;
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
