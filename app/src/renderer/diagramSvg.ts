export function getRenderedDiagramSvgText(root: ParentNode): string | null {
  const svg = root.querySelector<SVGSVGElement>(".preview-diagram-svg svg");
  if (!svg) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("style");
  if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const text = new XMLSerializer().serializeToString(clone).trim();
  return hasRenderableSvg(text) ? text : null;
}

function hasRenderableSvg(svg: string): boolean {
  const match = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i.exec(svg.trim());
  return Boolean(match?.[1].trim());
}
