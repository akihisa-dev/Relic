type MermaidThemeKey = "light" | "dark";
type MermaidModule = typeof import("mermaid").default;
type MermaidThemeVariables = Record<string, string>;

interface RelicMermaidTheme {
  key: MermaidThemeKey;
  themeVariables: MermaidThemeVariables;
}

let initializedTheme: MermaidThemeKey | null = null;
let renderId = 0;
const maxMermaidCacheEntries = 24;
const mermaidRenderCache = new Map<string, Promise<string>>();

export async function renderMermaidSvg(source: string): Promise<string> {
  const theme = getPreferredMermaidTheme();
  const cacheKey = `${theme.key}\n${source}`;
  const cached = mermaidRenderCache.get(cacheKey);

  if (cached) return cached;

  const renderPromise = renderMermaidSvgUncached(source, theme);
  rememberMermaidRender(cacheKey, renderPromise);
  return renderPromise;
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
      background: "#F4F0E6",
      mainBkg: "#FAF7F0",
      primaryColor: "#FAF7F0",
      primaryBorderColor: "#B8AF9F",
      primaryTextColor: "#1A1B17",
      secondaryColor: "#EBE5D9",
      secondaryBorderColor: "#D8D0C1",
      secondaryTextColor: "#1A1B17",
      tertiaryColor: "#F4F0E6",
      tertiaryBorderColor: "#D8D0C1",
      tertiaryTextColor: "#62625B",
      lineColor: "#62625B",
      textColor: "#1A1B17",
      titleColor: "#1A1B17",
      edgeLabelBackground: "#F4F0E6",
      nodeBorder: "#B8AF9F",
      clusterBkg: "#EBE5D9",
      clusterBorder: "#D8D0C1",
      defaultLinkColor: "#62625B",
      noteBkgColor: "#EBE5D9",
      noteBorderColor: "#B8AF9F",
      noteTextColor: "#1A1B17",
      actorBkg: "#FAF7F0",
      actorBorder: "#B8AF9F",
      actorTextColor: "#1A1B17",
      labelBoxBkgColor: "#F4F0E6",
      labelBoxBorderColor: "#D8D0C1",
      labelTextColor: "#1A1B17",
      loopTextColor: "#1A1B17",
      signalTextColor: "#1A1B17",
      sequenceNumberColor: "#1A1B17",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }
  },
  dark: {
    key: "dark",
    themeVariables: {
      background: "#11120F",
      mainBkg: "#191A16",
      primaryColor: "#191A16",
      primaryBorderColor: "#5B5D52",
      primaryTextColor: "#F4F0E6",
      secondaryColor: "#24251F",
      secondaryBorderColor: "#3B3C33",
      secondaryTextColor: "#F4F0E6",
      tertiaryColor: "#11120F",
      tertiaryBorderColor: "#3B3C33",
      tertiaryTextColor: "#B8B8AB",
      lineColor: "#B8B8AB",
      textColor: "#F4F0E6",
      titleColor: "#F4F0E6",
      edgeLabelBackground: "#11120F",
      nodeBorder: "#5B5D52",
      clusterBkg: "#24251F",
      clusterBorder: "#3B3C33",
      defaultLinkColor: "#B8B8AB",
      noteBkgColor: "#24251F",
      noteBorderColor: "#5B5D52",
      noteTextColor: "#F4F0E6",
      actorBkg: "#191A16",
      actorBorder: "#5B5D52",
      actorTextColor: "#F4F0E6",
      labelBoxBkgColor: "#11120F",
      labelBoxBorderColor: "#3B3C33",
      labelTextColor: "#F4F0E6",
      loopTextColor: "#F4F0E6",
      signalTextColor: "#F4F0E6",
      sequenceNumberColor: "#F4F0E6",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }
  }
};
