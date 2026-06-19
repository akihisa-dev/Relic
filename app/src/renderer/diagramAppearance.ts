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
}

const nodeColorTokens: Record<RelicDiagramNodeColorPreset, DiagramColorTokens> = {
  blue: { border: "#3261a1", fill: "#d8e6f7" },
  gray: { border: "#6f7885", fill: "#e6e8eb" },
  green: { border: "#287a54", fill: "#d8eee2" },
  red: { border: "#b43b34", fill: "#f6ddda" },
  yellow: { border: "#9b6b12", fill: "#f7e8bd" }
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
  const fillColor = diagramNodeFillColor(node);
  if (!fillColor) return null;

  const parsedFill = parseDiagramColor(fillColor);
  if (!parsedFill) return node.shape === "area" ? diagramNodeFallbackAreaTextColor : diagramNodeFallbackTextColor;

  const blendedFill = blendColorWithWhite(parsedFill);
  return chooseReadableTextColor(blendedFill);
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

const diagramNodeFallbackTextColor = "#1f1d19";
const diagramNodeFallbackAreaTextColor = "#4f4940";
const diagramReadableTextColors = ["#1f1d19", "#ffffff"] as const;

type ParsedColor = {
  a: number;
  b: number;
  g: number;
  r: number;
};

function parseDiagramColor(raw: string): ParsedColor | null {
  if (raw.startsWith("#")) {
    const normalized = raw.slice(1);
    if (normalized.length !== 6) return null;

    const r = Number.parseInt(normalized.slice(0, 2), 16);
    const g = Number.parseInt(normalized.slice(2, 4), 16);
    const b = Number.parseInt(normalized.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;

    return { a: 1, b, g, r };
  }

  const rgbaMatch = /^rgba?\(([^)]+)\)$/.exec(raw);
  if (!rgbaMatch) return null;

  const values = rgbaMatch[1].split(",").map((value) => value.trim());
  if (values.length < 3 || values.length > 4) return null;

  const parseChannel = (value: string): number | null => {
    if (value.endsWith("%")) {
      const percent = Number.parseFloat(value.slice(0, -1));
      if (!Number.isFinite(percent)) return null;
      return Math.max(0, Math.min(255, Math.round((percent / 100) * 255)));
    }
    const channel = Number.parseFloat(value);
    if (!Number.isFinite(channel)) return null;
    return Math.max(0, Math.min(255, Math.round(channel)));
  };

  const r = parseChannel(values[0]);
  const g = parseChannel(values[1]);
  const b = parseChannel(values[2]);
  if (r === null || g === null || b === null) return null;
  const rawAlpha = values[3] === undefined ? 1 : Number.parseFloat(values[3]);
  if (!Number.isFinite(rawAlpha)) return null;

  return {
    a: Math.max(0, Math.min(1, rawAlpha)),
    b,
    g,
    r
  };
}

function blendColorWithWhite(color: ParsedColor): { b: number; g: number; r: number } {
  return {
    b: Math.round(color.b * color.a + 255 * (1 - color.a)),
    g: Math.round(color.g * color.a + 255 * (1 - color.a)),
    r: Math.round(color.r * color.a + 255 * (1 - color.a))
  };
}

function chooseReadableTextColor(fill: { r: number; g: number; b: number }): string {
  const whiteContrast = contrastRatio(fill, { r: 255, g: 255, b: 255 });
  const darkContrast = contrastRatio(fill, parseDiagramColor(diagramNodeFallbackTextColor) as ParsedColor);
  return darkContrast > whiteContrast ? diagramReadableTextColors[0] : diagramReadableTextColors[1];
}

function luminance(color: { b: number; g: number; r: number }): number {
  const linear = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(left: { b: number; g: number; r: number }, right: { r: number; g: number; b: number }): number {
  const light = Math.max(luminance(left), luminance(right));
  const dark = Math.min(luminance(left), luminance(right));
  return (light + 0.05) / (dark + 0.05);
}
