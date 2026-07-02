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
      background: "#FFFFFF",
      mainBkg: "#FAFAFA",
      primaryColor: "#FAFAFA",
      primaryBorderColor: "#B8B8B8",
      primaryTextColor: "#111111",
      secondaryColor: "#F3F3F2",
      secondaryBorderColor: "#DEDEDE",
      secondaryTextColor: "#111111",
      tertiaryColor: "#FFFFFF",
      tertiaryBorderColor: "#DEDEDE",
      tertiaryTextColor: "#5F6368",
      lineColor: "#5F6368",
      textColor: "#111111",
      titleColor: "#111111",
      edgeLabelBackground: "#FFFFFF",
      nodeBorder: "#B8B8B8",
      clusterBkg: "#F3F3F2",
      clusterBorder: "#DEDEDE",
      defaultLinkColor: "#5F6368",
      noteBkgColor: "#F3F3F2",
      noteBorderColor: "#B8B8B8",
      noteTextColor: "#111111",
      actorBkg: "#FAFAFA",
      actorBorder: "#B8B8B8",
      actorTextColor: "#111111",
      labelBoxBkgColor: "#FFFFFF",
      labelBoxBorderColor: "#DEDEDE",
      labelTextColor: "#111111",
      loopTextColor: "#111111",
      signalTextColor: "#111111",
      sequenceNumberColor: "#111111",
      fontFamily: "Inter, Noto Sans JP, system-ui, sans-serif"
    }
  },
  dark: {
    key: "dark",
    themeVariables: {
      background: "#111111",
      mainBkg: "#171717",
      primaryColor: "#171717",
      primaryBorderColor: "#4A4A4A",
      primaryTextColor: "#F4F4F4",
      secondaryColor: "#202020",
      secondaryBorderColor: "#303030",
      secondaryTextColor: "#F4F4F4",
      tertiaryColor: "#141414",
      tertiaryBorderColor: "#303030",
      tertiaryTextColor: "#C2C2C2",
      lineColor: "#C2C2C2",
      textColor: "#F4F4F4",
      titleColor: "#F4F4F4",
      edgeLabelBackground: "#141414",
      nodeBorder: "#4A4A4A",
      clusterBkg: "#202020",
      clusterBorder: "#303030",
      defaultLinkColor: "#C2C2C2",
      noteBkgColor: "#202020",
      noteBorderColor: "#4A4A4A",
      noteTextColor: "#F4F4F4",
      actorBkg: "#171717",
      actorBorder: "#4A4A4A",
      actorTextColor: "#F4F4F4",
      labelBoxBkgColor: "#141414",
      labelBoxBorderColor: "#303030",
      labelTextColor: "#F4F4F4",
      loopTextColor: "#F4F4F4",
      signalTextColor: "#F4F4F4",
      sequenceNumberColor: "#F4F4F4",
      fontFamily: "Inter, Noto Sans JP, system-ui, sans-serif"
    }
  }
};
