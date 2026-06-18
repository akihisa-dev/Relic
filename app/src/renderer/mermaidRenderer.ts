type MermaidTheme = "default" | "dark";
type MermaidModule = typeof import("mermaid").default;

let initializedTheme: MermaidTheme | null = null;
let renderId = 0;
const maxMermaidCacheEntries = 24;
const mermaidRenderCache = new Map<string, Promise<string>>();

export async function renderMermaidSvg(source: string): Promise<string> {
  const theme = getPreferredMermaidTheme();
  const cacheKey = `${theme}\n${source}`;
  const cached = mermaidRenderCache.get(cacheKey);

  if (cached) return cached;

  const renderPromise = renderMermaidSvgUncached(source, theme);
  rememberMermaidRender(cacheKey, renderPromise);
  return renderPromise;
}

async function renderMermaidSvgUncached(source: string, theme: MermaidTheme): Promise<string> {
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

async function loadMermaid(theme: MermaidTheme): Promise<MermaidModule> {
  const mermaid = (await import("mermaid")).default;

  if (initializedTheme !== theme) {
    mermaid.initialize({
      theme,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      securityLevel: "strict",
      startOnLoad: false
    });
    initializedTheme = theme;
  }

  return mermaid;
}

function getPreferredMermaidTheme(): MermaidTheme {
  const rootTheme = document.documentElement.getAttribute("data-theme");

  if (rootTheme === "dark") return "dark";
  if (rootTheme === "light") return "default";

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "default";
}
