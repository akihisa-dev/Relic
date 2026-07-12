import { defaultGraphOptions, type GraphColorGroup, type GraphOptions, type GraphSectionCollapsedState } from "./graphTypes";

export const graphOptionsStorageKey = "relic.graphView.options.v1";
export const graphControlsStorageKey = "relic.graphView.controlsOpen.v1";
export const graphColorGroupsStorageKey = "relic.graphView.colorGroups.v1";
export const graphSectionCollapsedStorageKey = "relic.graphView.sectionCollapsed.v1";

const defaultGraphSectionCollapsed: GraphSectionCollapsedState = {
  display: true,
  filter: true,
  forces: true,
  groups: true
};

export function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function getCanvas2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom")) {
    return null;
  }

  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

export function nextGroupColor(index: number): string {
  const colors = [
    ["--color-accent", "#f2691b"],
    ["--color-primary", "#1a1b17"],
    ["--color-text-secondary", "#62625b"],
    ["--color-text-muted", "#76756c"],
    ["--color-border-strong", "#b8af9f"],
    ["--color-accent-strong", "#d95711"]
  ] as const;
  const [token, fallback] = colors[index % colors.length];

  return cssVar(token, fallback);
}

export function loadGraphOptions(): GraphOptions {
  const stored = loadJson<Partial<GraphOptions>>(graphOptionsStorageKey);

  return sanitizeGraphOptions(stored);
}

export function sanitizeGraphOptions(value: Partial<GraphOptions> | null): GraphOptions {
  if (!value || typeof value !== "object") return defaultGraphOptions;

  return {
    centerStrength: safeNumber(value.centerStrength, defaultGraphOptions.centerStrength, 0, 1),
    hideUnresolved: typeof value.hideUnresolved === "boolean" ? value.hideUnresolved : defaultGraphOptions.hideUnresolved,
    lineSizeMultiplier: safeNumber(value.lineSizeMultiplier, defaultGraphOptions.lineSizeMultiplier, 0.1, 5),
    linkDistance: safeNumber(value.linkDistance, defaultGraphOptions.linkDistance, 30, 500),
    linkStrength: safeNumber(value.linkStrength, defaultGraphOptions.linkStrength, 0, 1),
    nodeSizeMultiplier: safeNumber(value.nodeSizeMultiplier, defaultGraphOptions.nodeSizeMultiplier, 0.1, 5),
    repelStrength: safeNumber(value.repelStrength, defaultGraphOptions.repelStrength, 0, 20),
    search: typeof value.search === "string" ? value.search.slice(0, 200) : defaultGraphOptions.search,
    showArrows: typeof value.showArrows === "boolean" ? value.showArrows : defaultGraphOptions.showArrows,
    showAttachments: typeof value.showAttachments === "boolean" ? value.showAttachments : defaultGraphOptions.showAttachments,
    showOrphans: typeof value.showOrphans === "boolean" ? value.showOrphans : defaultGraphOptions.showOrphans,
    showTags: typeof value.showTags === "boolean" ? value.showTags : defaultGraphOptions.showTags,
    textFadeMultiplier: safeNumber(value.textFadeMultiplier, defaultGraphOptions.textFadeMultiplier, -3, 3)
  };
}

export function loadGraphControlsOpen(): boolean {
  const stored = loadJson<boolean>(graphControlsStorageKey);

  return typeof stored === "boolean" ? stored : true;
}

export function loadGraphColorGroups(): GraphColorGroup[] {
  const stored = loadJson<unknown>(graphColorGroupsStorageKey);
  if (!Array.isArray(stored)) return [];

  return stored.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const group = item as Partial<GraphColorGroup>;
    if (typeof group.query !== "string" || typeof group.color !== "string") return [];

    return [{
      color: /^#[0-9a-f]{6}$/i.test(group.color) ? group.color : nextGroupColor(index),
      id: typeof group.id === "string" ? group.id : `group-${index}`,
      query: group.query.slice(0, 200)
    }];
  }).slice(0, 12);
}

export function loadGraphSectionCollapsed(): GraphSectionCollapsedState {
  const stored = loadJson<Partial<GraphSectionCollapsedState>>(graphSectionCollapsedStorageKey);
  if (!stored || typeof stored !== "object") return defaultGraphSectionCollapsed;

  return {
    display: typeof stored.display === "boolean" ? stored.display : defaultGraphSectionCollapsed.display,
    filter: typeof stored.filter === "boolean" ? stored.filter : defaultGraphSectionCollapsed.filter,
    forces: typeof stored.forces === "boolean" ? stored.forces : defaultGraphSectionCollapsed.forces,
    groups: typeof stored.groups === "boolean" ? stored.groups : defaultGraphSectionCollapsed.groups
  };
}

export function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 設定保存に失敗してもグラフ表示自体は継続する。
  }
}

export function requestGraphFrame(callback: FrameRequestCallback): number {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(performance.now()), 16);
}

export function cancelGraphFrame(id: number): void {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(id);
    return;
  }

  window.clearTimeout(id);
}
