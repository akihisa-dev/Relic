import type { WorkspaceGraphNode } from "../../shared/ipc";

export interface GraphDrawTheme {
  accent: string;
  background: string;
  border: string;
  borderStrong: string;
  primary: string;
  text: string;
  textMuted: string;
  textSecondary: string;
}

export const defaultGraphDrawTheme: GraphDrawTheme = {
  accent: "#050505",
  background: "#fffffe",
  border: "rgba(5, 5, 5, 0.2)",
  borderStrong: "rgba(5, 5, 5, 0.46)",
  primary: "#050505",
  text: "#050505",
  textMuted: "rgba(5, 5, 5, 0.6)",
  textSecondary: "rgba(5, 5, 5, 0.74)"
};

export function readGraphDrawTheme(element: Element = document.documentElement): GraphDrawTheme {
  if (typeof window === "undefined") return defaultGraphDrawTheme;

  const styles = getComputedStyle(element);
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    accent: token("--color-accent", defaultGraphDrawTheme.accent),
    background: token("--color-bg", defaultGraphDrawTheme.background),
    border: token("--color-border", defaultGraphDrawTheme.border),
    borderStrong: token("--color-border-strong", defaultGraphDrawTheme.borderStrong),
    primary: token("--color-primary", defaultGraphDrawTheme.primary),
    text: token("--color-text", defaultGraphDrawTheme.text),
    textMuted: token("--color-text-muted", defaultGraphDrawTheme.textMuted),
    textSecondary: token("--color-text-secondary", defaultGraphDrawTheme.textSecondary)
  };
}

export function graphCategoryColor(category: string, theme: GraphDrawTheme): string {
  const tone = Math.abs(graphCategoryHash(category)) % 41;
  const lightness = graphThemeIsDark(theme.background) ? 82 - tone : 18 + tone;
  return `hsl(0 0% ${lightness}%)`;
}

export function graphCategoryColors(
  categories: Iterable<string>,
  theme: GraphDrawTheme
): ReadonlyMap<string, string> {
  const orderedCategories = [...new Set(
    [...categories].map((category) => category.trim()).filter(Boolean)
  )].sort((left, right) => (
    (graphCategoryHash(left) >>> 0) - (graphCategoryHash(right) >>> 0) ||
    left.localeCompare(right)
  ));
  if (orderedCategories.length === 1) {
    const category = orderedCategories[0]!;
    return new Map([[category, graphCategoryColor(category, theme)]]);
  }

  const dark = graphThemeIsDark(theme.background);
  const toneStart = dark ? 82 : 18;
  const toneSpan = dark ? -40 : 40;
  return new Map(orderedCategories.map((category, index) => {
    const progress = orderedCategories.length <= 1 ? 0 : index / (orderedCategories.length - 1);
    const lightness = Math.round(toneStart + toneSpan * progress);
    return [category, `hsl(0 0% ${lightness}%)`];
  }));
}

export function graphNodeColor(
  node: WorkspaceGraphNode,
  theme: GraphDrawTheme,
  categoryColors?: ReadonlyMap<string, string>
): string {
  const category = typeof node.category === "string" ? node.category.trim() : "";
  if (node.type === "file" && category) {
    return categoryColors?.get(category) ?? graphCategoryColor(category, theme);
  }
  if (node.type === "tag") return theme.accent;
  if (node.type === "attachment" || node.type === "unresolved") return theme.textMuted;
  return theme.textSecondary;
}

function graphCategoryHash(category: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < category.length; index += 1) {
    hash ^= category.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash;
}

export function graphThemeIsDark(background: string): boolean {
  const normalized = background.trim();
  const hexadecimal = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hexadecimal) {
    const value = hexadecimal[1]!;
    const expanded = value.length === 3
      ? [...value].map((character) => `${character}${character}`).join("")
      : value;
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 128;
  }

  const rgb = normalized.match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  if (!rgb) return false;
  const red = Number(rgb[1]);
  const green = Number(rgb[2]);
  const blue = Number(rgb[3]);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 < 128;
}
