import type { Plugin } from "vite";

const katexCssPaths = [
  "/node_modules/katex/dist/katex.css",
  "/node_modules/katex/dist/katex.min.css"
];

interface CssRange {
  end: number;
  start: number;
}

export interface KatexFontCssTransformResult {
  css: string;
  fontFaceCount: number;
  removedSourceCount: number;
}

export function katexWoff2OnlyCssPlugin(): Plugin {
  return {
    enforce: "pre",
    name: "relic-katex-woff2-only",
    transform(code, id) {
      if (!isKatexCssId(id)) return null;
      return {
        code: transformKatexFontCssToWoff2(code).css,
        map: null
      };
    }
  };
}

export function isKatexCssId(id: string): boolean {
  const normalized = id.replace(/\\/g, "/").split("?", 1)[0];
  return katexCssPaths.some((suffix) => normalized?.endsWith(suffix));
}

export function transformKatexFontCssToWoff2(css: string): KatexFontCssTransformResult {
  const blocks = findAtRuleBlocks(css, "@font-face");
  if (blocks.length === 0) throw new Error("KaTeX CSS does not contain any @font-face rules.");

  const replacements: Array<CssRange & { value: string }> = [];
  let removedSourceCount = 0;

  for (const block of blocks) {
    const sourceDeclarations = findDeclarations(css, block).filter((declaration) =>
      css.slice(declaration.property.start, declaration.property.end).trim().toLocaleLowerCase() === "src"
    );
    if (sourceDeclarations.length !== 1) {
      throw new Error("Each KaTeX @font-face rule must contain exactly one src declaration.");
    }

    const source = sourceDeclarations[0];
    const ranges = splitTopLevel(css, source.value, ",");
    const woff2Sources = ranges.filter((range) => isWoff2FontSource(css.slice(range.start, range.end)));
    if (woff2Sources.length !== 1) {
      throw new Error("Each KaTeX @font-face src declaration must contain exactly one WOFF2 source.");
    }

    const value = css.slice(source.value.start, source.value.end);
    const leadingWhitespace = value.match(/^\s*/u)?.[0] ?? "";
    const trailingWhitespace = value.match(/\s*$/u)?.[0] ?? "";
    replacements.push({
      end: source.value.end,
      start: source.value.start,
      value: `${leadingWhitespace}${css.slice(woff2Sources[0].start, woff2Sources[0].end).trim()}${trailingWhitespace}`
    });
    removedSourceCount += ranges.length - 1;
  }

  let transformed = css;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    transformed = `${transformed.slice(0, replacement.start)}${replacement.value}${transformed.slice(replacement.end)}`;
  }

  validateTransformedFontFaces(transformed, blocks.length);
  return { css: transformed, fontFaceCount: blocks.length, removedSourceCount };
}

function validateTransformedFontFaces(css: string, expectedCount: number): void {
  const blocks = findAtRuleBlocks(css, "@font-face");
  if (blocks.length !== expectedCount) throw new Error("KaTeX @font-face rule count changed during transformation.");

  for (const block of blocks) {
    const sourceDeclarations = findDeclarations(css, block).filter((declaration) =>
      css.slice(declaration.property.start, declaration.property.end).trim().toLocaleLowerCase() === "src"
    );
    if (sourceDeclarations.length !== 1) throw new Error("Transformed KaTeX font rule has an invalid src declaration.");
    const sources = splitTopLevel(css, sourceDeclarations[0].value, ",");
    if (sources.length !== 1 || !isWoff2FontSource(css.slice(sources[0].start, sources[0].end))) {
      throw new Error("Transformed KaTeX font rule contains a non-WOFF2 source.");
    }
  }
}

function findAtRuleBlocks(css: string, atRule: string): CssRange[] {
  const blocks: CssRange[] = [];
  let index = 0;
  while (index < css.length) {
    const token = findCodeToken(css, atRule, index);
    if (token < 0) break;
    const openingBrace = findCodeCharacter(css, "{", token + atRule.length);
    if (openingBrace < 0) throw new Error(`Unclosed ${atRule} rule.`);
    const closingBrace = findMatchingCharacter(css, openingBrace, "{", "}");
    if (closingBrace < 0) throw new Error(`Unclosed ${atRule} block.`);
    blocks.push({ start: openingBrace + 1, end: closingBrace });
    index = closingBrace + 1;
  }
  return blocks;
}

function findDeclarations(css: string, block: CssRange): Array<{ property: CssRange; value: CssRange }> {
  const declarations = [];
  for (const segment of splitTopLevel(css, block, ";")) {
    const colon = findTopLevelCharacter(css, segment, ":");
    if (colon < 0) continue;
    declarations.push({
      property: { start: segment.start, end: colon },
      value: { start: colon + 1, end: segment.end }
    });
  }
  return declarations;
}

function splitTopLevel(css: string, range: CssRange, separator: string): CssRange[] {
  const ranges = [];
  let segmentStart = range.start;
  let parentheses = 0;
  let index = range.start;

  while (index < range.end) {
    const skipped = skipStringOrComment(css, index, range.end);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    const character = css[index];
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === separator && parentheses === 0) {
      ranges.push({ start: segmentStart, end: index });
      segmentStart = index + 1;
    }
    index += 1;
  }

  ranges.push({ start: segmentStart, end: range.end });
  return ranges;
}

function findTopLevelCharacter(css: string, range: CssRange, target: string): number {
  let parentheses = 0;
  let index = range.start;
  while (index < range.end) {
    const skipped = skipStringOrComment(css, index, range.end);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    const character = css[index];
    if (character === "(") parentheses += 1;
    else if (character === ")") parentheses = Math.max(0, parentheses - 1);
    else if (character === target && parentheses === 0) return index;
    index += 1;
  }
  return -1;
}

function isWoff2FontSource(source: string): boolean {
  const functions = collectCssFunctions(source);
  const url = functions.find((item) => item.name === "url");
  const format = functions.find((item) => item.name === "format");
  if (!url || !format) return false;
  const urlValue = unquote(url.value).split(/[?#]/u, 1)[0]?.toLocaleLowerCase();
  return urlValue?.endsWith(".woff2") === true && unquote(format.value).toLocaleLowerCase() === "woff2";
}

function collectCssFunctions(value: string): Array<{ name: string; value: string }> {
  const functions = [];
  let index = 0;
  while (index < value.length) {
    const skipped = skipStringOrComment(value, index, value.length);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (!/[A-Za-z-]/u.test(value[index] ?? "")) {
      index += 1;
      continue;
    }
    const nameStart = index;
    while (/[A-Za-z0-9_-]/u.test(value[index] ?? "")) index += 1;
    const name = value.slice(nameStart, index).toLocaleLowerCase();
    while (/\s/u.test(value[index] ?? "")) index += 1;
    if (value[index] !== "(") continue;
    const closing = findMatchingCharacter(value, index, "(", ")");
    if (closing < 0) return [];
    functions.push({ name, value: value.slice(index + 1, closing).trim() });
    index = closing + 1;
  }
  return functions;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if ((first === "\"" || first === "'") && trimmed.at(-1) === first) return trimmed.slice(1, -1);
  return trimmed;
}

function findCodeToken(css: string, token: string, start: number): number {
  let index = start;
  while (index < css.length) {
    const skipped = skipStringOrComment(css, index, css.length);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (css.startsWith(token, index)) return index;
    index += 1;
  }
  return -1;
}

function findCodeCharacter(css: string, target: string, start: number): number {
  let index = start;
  while (index < css.length) {
    const skipped = skipStringOrComment(css, index, css.length);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (css[index] === target) return index;
    index += 1;
  }
  return -1;
}

function findMatchingCharacter(value: string, openingIndex: number, opening: string, closing: string): number {
  let depth = 0;
  let index = openingIndex;
  while (index < value.length) {
    const skipped = skipStringOrComment(value, index, value.length);
    if (skipped !== index) {
      index = skipped;
      continue;
    }
    if (value[index] === opening) depth += 1;
    else if (value[index] === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

function skipStringOrComment(value: string, index: number, end: number): number {
  if (value[index] === "/" && value[index + 1] === "*") {
    const closing = value.indexOf("*/", index + 2);
    return closing < 0 ? end : closing + 2;
  }
  const quote = value[index];
  if (quote !== "\"" && quote !== "'") return index;
  index += 1;
  while (index < end) {
    if (value[index] === "\\") index += 2;
    else if (value[index] === quote) return index + 1;
    else index += 1;
  }
  return end;
}
