const outputSvgUriAttributes = new Set(["href", "xlink:href", "src"]);
const outputSvgUrlFunctionAttributes = new Set([
  "clip-path",
  "cursor",
  "fill",
  "filter",
  "marker-end",
  "marker-mid",
  "marker-start",
  "mask",
  "stroke"
]);
const forbiddenOutputSvgTags = new Set(["base", "foreignobject", "script"]);
const forbiddenOutputSvgBlockPatterns = [...forbiddenOutputSvgTags].map((tagName) => new RegExp(
  `<\\s*${tagName}\\b[^>]*(?:\\/>|[\\s\\S]*?<\\s*\\/\\s*${tagName}\\s*>)`,
  "gi"
));
const processingInstructionPattern = /<\?[\s\S]*?\?>/gi;
const svgStyleBlockPattern = /(<\s*style\b[^>]*>)([\s\S]*?)(<\s*\/\s*style\s*>)/gi;

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
  let sanitized = svg.replace(processingInstructionPattern, "");

  for (const forbiddenBlockPattern of forbiddenOutputSvgBlockPatterns) {
    sanitized = sanitized.replace(forbiddenBlockPattern, "");
  }

  sanitized = sanitized.replace(svgStyleBlockPattern, (_match, openingTag: string, cssText: string, closingTag: string) => (
    `${openingTag}${sanitizeOutputSvgCss(cssText)}${closingTag}`
  ));

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

    if (
      name === "base" ||
      name === "xml:base" ||
      name === "style" ||
      name.startsWith("on") ||
      (outputSvgUriAttributes.has(name) && !isSafeOutputSvgUri(value)) ||
      (outputSvgUrlFunctionAttributes.has(name) && !isSafeOutputSvgUrlFunction(value))
    ) {
      continue;
    }

    sanitized.push(match[0]);
  }

  return sanitized.join("");
}

function isSafeOutputSvgUri(value: string): boolean {
  const trimmed = decodeNumericCharacterReferences(value).trim();
  const normalized = trimmed.replace(/[\u0000-\u0020]+/g, "");

  return /^#[A-Za-z_][\w:.-]*$/.test(normalized);
}

function isSafeOutputSvgUrlFunction(value: string): boolean {
  const decoded = decodeNumericCharacterReferences(value);
  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let foundUrl = false;

  for (const match of decoded.matchAll(urlPattern)) {
    foundUrl = true;
    const url = (match[2] ?? "").replace(/[\u0000-\u0020]+/g, "");
    if (!/^#[A-Za-z_][\w:.-]*$/.test(url)) return false;
  }

  return foundUrl || !/url\s*\(/i.test(decoded);
}

function sanitizeOutputSvgCss(cssText: string): string {
  let sanitized = cssText.replace(/@import\b[^;{}]*(?:;|$)/gi, "");
  const decoded = decodeNumericCharacterReferences(sanitized);
  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;

  return decoded.replace(urlPattern, (match, _quote: string, rawUrl: string) => {
    const url = rawUrl.replace(/[\u0000-\u0020]+/g, "");
    return /^#[A-Za-z_][\w:.-]*$/.test(url) ? match : "";
  });
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
