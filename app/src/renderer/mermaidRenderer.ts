import { withDiagramRenderTimeout } from "./diagramLimits";

type MermaidThemeKey = "light" | "dark";
type MermaidModule = typeof import("mermaid").default;
type MermaidThemeVariables = Record<string, string>;

interface RelicMermaidTheme {
  key: MermaidThemeKey;
  themeVariables: MermaidThemeVariables;
}

let initializedTheme: MermaidThemeKey | null = null;
let renderId = 0;
let mermaidRenderQueue: Promise<void> = Promise.resolve();
const maxMermaidCacheEntries = 24;
const mermaidRenderCache = new Map<string, Promise<string>>();

export async function renderMermaidSvg(source: string): Promise<string> {
  const theme = getPreferredMermaidTheme();
  const cacheKey = `${theme.key}\n${source}`;
  const cached = mermaidRenderCache.get(cacheKey);

  if (cached) return cached;

  // Mermaid uses a process-global renderer. Keep the queue chained to the
  // uncancelled operation so a caller timeout cannot let two renders overlap.
  const renderOperation = mermaidRenderQueue.then(() => renderMermaidSvgUncached(source, theme));
  const timedOperation = withDiagramRenderTimeout(renderOperation, "mermaid");
  rememberMermaidRender(cacheKey, timedOperation);
  // A timed-out caller may retry this source, but only after the underlying
  // operation settles at the queue boundary. Do not evict a newer retry.
  void timedOperation.catch(() => {
    if (mermaidRenderCache.get(cacheKey) === timedOperation) mermaidRenderCache.delete(cacheKey);
  });
  mermaidRenderQueue = renderOperation.then(
    () => undefined,
    () => {
      if (mermaidRenderCache.get(cacheKey) === timedOperation) mermaidRenderCache.delete(cacheKey);
    }
  );

  return timedOperation;
}

async function renderMermaidSvgUncached(source: string, theme: RelicMermaidTheme): Promise<string> {
  const mermaid = await loadMermaid(theme);
  const id = `relic-mermaid-${renderId++}`;
  const { svg } = await mermaid.render(id, source);
  return svg;
}

function rememberMermaidRender(cacheKey: string, renderPromise: Promise<string>): void {
  mermaidRenderCache.set(cacheKey, renderPromise);

  if (mermaidRenderCache.size > maxMermaidCacheEntries) {
    const oldestKey = mermaidRenderCache.keys().next().value;
    if (oldestKey) mermaidRenderCache.delete(oldestKey);
  }
}

async function loadMermaid(theme: RelicMermaidTheme): Promise<MermaidModule> {
  const mermaid = (await import("mermaid")).default;

  if (initializedTheme !== theme.key) {
    mermaid.initialize({
      theme: "base",
      themeVariables: theme.themeVariables,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      securityLevel: "strict",
      startOnLoad: false
    });
    initializedTheme = theme.key;
  }

  return mermaid;
}

function getPreferredMermaidTheme(): RelicMermaidTheme {
  const rootTheme = document.documentElement.getAttribute("data-theme");

  if (rootTheme === "dark") return relicMermaidThemes.dark;
  if (rootTheme === "light") return relicMermaidThemes.light;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? relicMermaidThemes.dark
    : relicMermaidThemes.light;
}

const relicMermaidThemes: Record<MermaidThemeKey, RelicMermaidTheme> = {
  light: {
    key: "light",
    themeVariables: {
      background: "#FFFFFE",
      mainBkg: "#FFFFFE",
      primaryColor: "#FFFFFE",
      primaryBorderColor: "#050505",
      primaryTextColor: "#050505",
      secondaryColor: "#050505",
      secondaryBorderColor: "#050505",
      secondaryTextColor: "#FFFFFE",
      tertiaryColor: "#FFFFFE",
      tertiaryBorderColor: "#050505",
      tertiaryTextColor: "#050505",
      lineColor: "#050505",
      textColor: "#050505",
      titleColor: "#050505",
      edgeLabelBackground: "#FFFFFE",
      nodeBorder: "#050505",
      clusterBkg: "#FFFFFE",
      clusterBorder: "#050505",
      defaultLinkColor: "#050505",
      noteBkgColor: "#050505",
      noteBorderColor: "#050505",
      noteTextColor: "#FFFFFE",
      actorBkg: "#FFFFFE",
      actorBorder: "#050505",
      actorTextColor: "#050505",
      labelBoxBkgColor: "#FFFFFE",
      labelBoxBorderColor: "#050505",
      labelTextColor: "#050505",
      loopTextColor: "#050505",
      signalTextColor: "#050505",
      sequenceNumberColor: "#050505",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }
  },
  dark: {
    key: "dark",
    themeVariables: {
      background: "#050505",
      mainBkg: "#050505",
      primaryColor: "#050505",
      primaryBorderColor: "#FFFFFE",
      primaryTextColor: "#FFFFFE",
      secondaryColor: "#FFFFFE",
      secondaryBorderColor: "#FFFFFE",
      secondaryTextColor: "#050505",
      tertiaryColor: "#050505",
      tertiaryBorderColor: "#FFFFFE",
      tertiaryTextColor: "#FFFFFE",
      lineColor: "#FFFFFE",
      textColor: "#FFFFFE",
      titleColor: "#FFFFFE",
      edgeLabelBackground: "#050505",
      nodeBorder: "#FFFFFE",
      clusterBkg: "#050505",
      clusterBorder: "#FFFFFE",
      defaultLinkColor: "#FFFFFE",
      noteBkgColor: "#FFFFFE",
      noteBorderColor: "#FFFFFE",
      noteTextColor: "#050505",
      actorBkg: "#050505",
      actorBorder: "#FFFFFE",
      actorTextColor: "#FFFFFE",
      labelBoxBkgColor: "#050505",
      labelBoxBorderColor: "#FFFFFE",
      labelTextColor: "#FFFFFE",
      loopTextColor: "#FFFFFE",
      signalTextColor: "#FFFFFE",
      sequenceNumberColor: "#FFFFFE",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }
  }
};
