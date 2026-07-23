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
  accent: "#f2691b",
  background: "#ffffff",
  border: "#3b3c33",
  borderStrong: "#5b5d52",
  primary: "#1a1b17",
  text: "#1e1e1e",
  textMuted: "#76756c",
  textSecondary: "#62625b"
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
  let hash = 2_166_136_261;
  for (let index = 0; index < category.length; index += 1) {
    hash ^= category.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  const hue = Math.abs(hash) % 360;
  const lightness = graphThemeIsDark(theme.background) ? 68 : 40;
  return `hsl(${hue} 62% ${lightness}%)`;
}

export function graphNodeColor(
  node: WorkspaceGraphNode,
  theme: GraphDrawTheme
): string {
  const category = typeof node.category === "string" ? node.category.trim() : "";
  if (node.type === "file" && category) return graphCategoryColor(category, theme);
  if (node.type === "tag") return theme.accent;
  if (node.type === "attachment" || node.type === "unresolved") return theme.textMuted;
  return theme.textSecondary;
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
