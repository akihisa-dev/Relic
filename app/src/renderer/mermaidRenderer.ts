type MermaidTheme = "default" | "dark";
type MermaidModule = typeof import("mermaid").default;

let initializedTheme: MermaidTheme | null = null;
let renderId = 0;

export async function renderMermaidSvg(source: string): Promise<string> {
  const mermaid = await loadMermaid();
  const id = `relic-mermaid-${renderId++}`;
  const { svg } = await mermaid.render(id, source);
  return svg;
}

async function loadMermaid(): Promise<MermaidModule> {
  const mermaid = (await import("mermaid")).default;
  const theme = getPreferredMermaidTheme();

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
