const outputSvgUriAttributes = new Set(["href", "xlink:href", "src"]);
const forbiddenOutputSvgTags = new Set(["foreignobject", "script"]);
const forbiddenOutputSvgBlockPatterns = [...forbiddenOutputSvgTags].map((tagName) => new RegExp(
  `<\\s*${tagName}\\b[^>]*(?:\\/>|[\\s\\S]*?<\\s*\\/\\s*${tagName}\\s*>)`,
  "gi"
));

export function hasRenderableSvg(svg: string): boolean {
  const match = /<svg\b[^>]*>([\s\S]*?)<\/svg>/i.exec(svg.trim());
  return Boolean(match?.[1].trim());
}

export function sanitizeOutputSvg(svg: string): string {
  const match = /<svg\b[\s\S]*?<\/svg>/i.exec(svg.trim());
  if (!match) return "";

  return sanitizeOutputSvgMarkup(match[0]).trim();
}

function sanitizeOutputSvgMarkup(svg: string): string {
  let sanitized = svg;

  for (const forbiddenBlockPattern of forbiddenOutputSvgBlockPatterns) {
    sanitized = sanitized.replace(forbiddenBlockPattern, "");
  }

  return sanitized.replace(/<([A-Za-z][\w:.-]*)([^<>]*?)(\/?)>/g, (_tag, tagName: string, rawAttributes: string, selfClosing: string) => {
    if (forbiddenOutputSvgTags.has(tagName.toLowerCase())) return "";
    const attributes = sanitizeOutputSvgAttributes(rawAttributes);
    return `<${tagName}${attributes}${selfClosing}>`;
  });
}

function sanitizeOutputSvgAttributes(rawAttributes: string): string {
  const sanitized: string[] = [];
  const attributePattern = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  for (const match of rawAttributes.matchAll(attributePattern)) {
    const rawName = match[1] ?? "";
    const name = rawName.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (name.startsWith("on") || (outputSvgUriAttributes.has(name) && !isSafeOutputSvgUri(value))) {
      continue;
    }

    sanitized.push(match[0]);
  }

  return sanitized.join("");
}

function isSafeOutputSvgUri(value: string): boolean {
  const trimmed = decodeNumericCharacterReferences(value).trim();
  const scheme = trimmed.replace(/[\u0000-\u0020]+/g, "").match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();

  return scheme === undefined || scheme === "http" || scheme === "https" || scheme === "mailto";
}

function decodeNumericCharacterReferences(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);?/gi, (_match, rawCodePoint: string) => {
    const codePoint = rawCodePoint.toLowerCase().startsWith("x")
      ? Number.parseInt(rawCodePoint.slice(1), 16)
      : Number.parseInt(rawCodePoint, 10);

    if (!Number.isFinite(codePoint)) return "";

    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return "";
    }
  });
}
