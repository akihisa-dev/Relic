import DOMPurify from "dompurify";

let initialized = false;
let renderId = 0;

type MermaidModule = typeof import("mermaid").default;

export function isMermaidLanguage(lang: string | undefined | null): boolean {
  return lang?.trim().split(/\s+/, 1)[0]?.toLowerCase() === "mermaid";
}

export function buildMermaidFallback(source: string): HTMLElement {
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = "language-mermaid";
  code.textContent = source;
  pre.append(code);
  return pre;
}

export async function renderMermaidElement(container: HTMLElement, source: string): Promise<void> {
  try {
    const mermaid = await loadMermaid();
    const id = `relic-mermaid-${renderId++}`;
    const { svg } = await mermaid.render(id, source);
    const sanitized = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });

    container.replaceChildren();
    const diagram = document.createElement("div");
    diagram.className = "preview-mermaid-svg";
    diagram.innerHTML = sanitized;
    container.append(diagram);
  } catch {
    container.replaceChildren(buildMermaidFallback(source));
  }
}

export function renderMermaidElements(root: ParentNode): void {
  const diagrams = root.querySelectorAll<HTMLElement>(".preview-mermaid");

  diagrams.forEach((diagram) => {
    const source = diagram.dataset.mermaidSource ?? diagram.querySelector("code")?.textContent;
    if (!source) return;
    void renderMermaidElement(diagram, source);
  });
}

async function loadMermaid(): Promise<MermaidModule> {
  const mermaid = (await import("mermaid")).default;

  if (!initialized) {
    mermaid.initialize({
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      securityLevel: "strict",
      startOnLoad: false
    });
    initialized = true;
  }

  return mermaid;
}
