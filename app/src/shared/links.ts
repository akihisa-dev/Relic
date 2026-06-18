import { ensureMarkdownExtension, stripMarkdownExtension } from "./markdownExtension";

export type WikiLinkKind = "embed" | "link";

export interface WikiLink {
  alias: string | null;
  blockId: string | null;
  heading: string | null;
  kind: WikiLinkKind;
  raw: string;
  target: string;
}

export interface ParsedWikiLinkBody {
  alias: string | null;
  blockId: string | null;
  heading: string | null;
  rawTargetBase: string;
  target: string;
  targetBase: string;
}

export interface WikiLinkMatch extends WikiLink, ParsedWikiLinkBody {
  body: string;
  bodyFrom: number;
  bodyTo: number;
  from: number;
  to: number;
}

export interface ResolvedWikiLink {
  displayName: string;
  exists: boolean;
  path: string;
  wikiLink: WikiLink;
}

export interface MarkdownLinkTarget {
  heading: string | null;
  path: string;
}

export type AliasIndex = Record<string, string[]>;

export function parseWikiLinks(markdown: string): WikiLink[] {
  return scanWikiLinks(markdown).map(({ body: _body, bodyFrom: _bodyFrom, bodyTo: _bodyTo, from: _from, rawTargetBase: _rawTargetBase, targetBase: _targetBase, to: _to, ...link }) => link);
}

export function scanWikiLinks(markdown: string, options: { ignoreCode?: boolean } = {}): WikiLinkMatch[] {
  const links: WikiLinkMatch[] = [];
  const source = options.ignoreCode === false ? markdown : maskMarkdownCodeRanges(markdown);
  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of source.matchAll(pattern)) {
    const from = match.index;
    const raw = match[0] ?? "";
    const body = match[2] ?? "";
    const parsed = parseWikiLinkBody(body);

    if (from !== undefined && raw && parsed) {
      links.push({
        ...parsed,
        body,
        bodyFrom: from + (match[1] === "!" ? 3 : 2),
        bodyTo: from + raw.length - 2,
        from,
        kind: match[1] === "!" ? "embed" : "link",
        raw,
        to: from + raw.length
      });
    }
  }

  return links;
}

export function formatWikiLinkBody(parts: {
  alias?: string | null;
  blockId?: string | null;
  heading?: string | null;
  targetBase: string;
}): string {
  let body = parts.targetBase;
  if (parts.heading) body += `#${parts.heading}`;
  if (parts.blockId) body += `^${parts.blockId}`;
  if (parts.alias !== undefined && parts.alias !== null) body += `|${parts.alias}`;

  return body;
}

export function formatWikiLink(kind: WikiLinkKind, parts: Parameters<typeof formatWikiLinkBody>[0]): string {
  return `${kind === "embed" ? "!" : ""}[[${formatWikiLinkBody(parts)}]]`;
}

export function formatWikiLinkTargetReference(parts: Pick<ParsedWikiLinkBody, "blockId" | "heading" | "rawTargetBase">): string {
  return formatWikiLinkBody({
    blockId: parts.blockId,
    heading: parts.heading,
    targetBase: parts.rawTargetBase
  });
}

export function normalizeWikiLinkTarget(target: string): string {
  const trimmed = target.trim().replace(/\\/g, "/");

  return ensureMarkdownExtension(trimmed);
}

export function resolveWikiLinkPath(target: string, sourcePath: string): string {
  const normalizedTarget = normalizeWikiLinkTarget(target);

  if (normalizedTarget.includes("/")) {
    return normalizePathSegments(normalizedTarget);
  }

  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";

  return normalizePathSegments(
    sourceDirectory === "" ? normalizedTarget : `${sourceDirectory}/${normalizedTarget}`
  );
}

export function resolveMarkdownLinkPath(href: string, sourcePath: string): MarkdownLinkTarget | null {
  const trimmedHref = href.trim();

  if (
    trimmedHref === "" ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref) ||
    trimmedHref.startsWith("//") ||
    trimmedHref.startsWith("#")
  ) {
    return null;
  }

  const [pathPart, headingPart] = trimmedHref.split("#", 2);
  const decodedPath = decodeMarkdownLinkPath(pathPart);
  const normalizedTarget = ensureMarkdownExtension(decodedPath);
  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";
  const resolvedPath = normalizedTarget.startsWith("/")
    ? normalizePathSegments(normalizedTarget)
    : normalizePathSegments(
      sourceDirectory === "" ? normalizedTarget : `${sourceDirectory}/${normalizedTarget}`
    );

  return {
    heading: headingPart ? decodeMarkdownLinkPath(headingPart).trim() || null : null,
    path: resolvedPath
  };
}

export function resolveWikiLinks(
  markdown: string,
  sourcePath: string,
  existingMarkdownPaths: Iterable<string>,
  aliasesByPath: AliasIndex = {}
): ResolvedWikiLink[] {
  return createWikiLinkResolver(existingMarkdownPaths, aliasesByPath)(markdown, sourcePath);
}

export function createWikiLinkResolver(
  existingMarkdownPaths: Iterable<string>,
  aliasesByPath: AliasIndex = {}
): (markdown: string, sourcePath: string) => ResolvedWikiLink[] {
  const normalizedExistingPaths = [...existingMarkdownPaths].map(normalizePathSegments);
  const existingPaths = new Set(normalizedExistingPaths);
  const uniqueBasenameTargets = buildUniqueBasenameTargetMap(normalizedExistingPaths);
  const aliasTargets = buildAliasTargetMap(aliasesByPath);

  return (markdown, sourcePath) => parseWikiLinks(markdown).map((wikiLink) => {
    const resolvedPath = resolveWikiLinkPath(wikiLink.target, sourcePath);
    const uniqueBasenamePath = existingPaths.has(resolvedPath)
      ? null
      : uniqueBasenameTargets.get(basenameLinkKey(wikiLink.target)) ?? null;
    const aliasPath = existingPaths.has(resolvedPath) || uniqueBasenamePath
      ? null
      : aliasTargets.get(aliasKey(wikiLink.target)) ?? null;
    const path = uniqueBasenamePath ?? aliasPath ?? resolvedPath;

    return {
      displayName: wikiLink.alias ?? basenameWithoutMarkdownExtension(path),
      exists: existingPaths.has(path),
      path,
      wikiLink
    };
  });
}

export function resolveWikiLinkPathWithAliases(
  target: string,
  sourcePath: string,
  existingMarkdownPaths: Iterable<string>,
  aliasesByPath: AliasIndex = {}
): string {
  const resolvedPath = resolveWikiLinkPath(target, sourcePath);
  const normalizedExistingPaths = [...existingMarkdownPaths].map(normalizePathSegments);
  const existingPaths = new Set(normalizedExistingPaths);

  if (existingPaths.has(resolvedPath)) return resolvedPath;

  const uniqueBasenamePath = buildUniqueBasenameTargetMap(normalizedExistingPaths).get(basenameLinkKey(target)) ?? null;
  if (uniqueBasenamePath) return uniqueBasenamePath;

  return buildAliasTargetMap(aliasesByPath).get(aliasKey(target)) ?? resolvedPath;
}

export function parseWikiLinkBody(body: string): ParsedWikiLinkBody | null {
  const pipeIndex = body.indexOf("|");
  const targetPart = pipeIndex >= 0 ? body.slice(0, pipeIndex) : body;
  const aliasPart = pipeIndex >= 0 ? body.slice(pipeIndex + 1) : null;
  const normalizedTargetPart = targetPart.trim();

  if (normalizedTargetPart === "") return null;

  const [targetWithHeading = "", blockId] = normalizedTargetPart.split("^", 2);
  const [targetBase = "", heading] = targetWithHeading.split("#", 2);
  const rawTargetBase = targetBase.trim();

  if (rawTargetBase === "") return null;

  const target = normalizeWikiLinkTarget(rawTargetBase);

  return {
    alias: aliasPart === null ? null : aliasPart.trim() || null,
    blockId: blockId?.trim() || null,
    heading: heading?.trim() || null,
    rawTargetBase,
    target,
    targetBase: target
  };
}

function basenameWithoutMarkdownExtension(path: string): string {
  return stripMarkdownExtension(path.split("/").at(-1) ?? path);
}

function basenameLinkKey(target: string): string {
  const normalizedTarget = normalizeWikiLinkTarget(target);
  if (normalizedTarget.includes("/")) return "";

  return markdownPathKey(normalizedTarget);
}

function buildUniqueBasenameTargetMap(paths: string[]): Map<string, string> {
  const targets = new Map<string, string | null>();

  for (const path of paths) {
    const basename = path.split("/").at(-1) ?? path;
    const key = markdownPathKey(basename);
    targets.set(key, targets.has(key) ? null : path);
  }

  return new Map([...targets.entries()].filter((entry): entry is [string, string] => entry[1] !== null));
}

function markdownPathKey(path: string): string {
  return `${stripMarkdownExtension(path)}.md`;
}

function maskMarkdownCodeRanges(markdown: string): string {
  const lines = markdown.match(/[^\n]*(?:\n|$)/g) ?? [];
  let fence: { marker: "`" | "~"; length: number } | null = null;

  return lines.map((line) => {
    if (line === "") return line;

    if (fence) {
      const closesFence = new RegExp(`^ {0,3}\\${fence.marker}{${fence.length},}`).test(line);
      if (closesFence) {
        fence = null;
      }

      return maskText(line);
    }

    const fenceStart = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceStart) {
      const markerRun = fenceStart[1];
      fence = {
        length: markerRun.length,
        marker: markerRun[0] as "`" | "~"
      };

      return maskText(line);
    }

    if (/^(?: {4}|\t)/.test(line)) {
      return maskText(line);
    }

    return maskInlineCodeSpans(line);
  }).join("");
}

function maskInlineCodeSpans(line: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < line.length) {
    const start = line.indexOf("`", cursor);
    if (start < 0) {
      output += line.slice(cursor);
      break;
    }

    let markerLength = 1;
    while (line[start + markerLength] === "`") {
      markerLength += 1;
    }

    const marker = "`".repeat(markerLength);
    const end = line.indexOf(marker, start + markerLength);
    if (end < 0) {
      output += line.slice(cursor);
      break;
    }

    output += line.slice(cursor, start);
    output += maskText(line.slice(start, end + markerLength));
    cursor = end + markerLength;
  }

  return output;
}

function maskText(value: string): string {
  return " ".repeat(value.length);
}

function normalizePathSegments(value: string): string {
  const output: string[] = [];

  for (const segment of value.replace(/\\/g, "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      output.pop();
      continue;
    }

    output.push(segment);
  }

  return output.join("/");
}

function buildAliasTargetMap(aliasesByPath: AliasIndex): Map<string, string> {
  const result = new Map<string, string>();

  for (const [path, aliases] of Object.entries(aliasesByPath).sort(([a], [b]) => a.localeCompare(b))) {
    for (const alias of aliases) {
      const key = aliasKey(alias);
      if (key && !result.has(key)) result.set(key, normalizePathSegments(path));
    }
  }

  return result;
}

function aliasKey(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .toLocaleLowerCase();
}

function decodeMarkdownLinkPath(value: string): string {
  try {
    return decodeURIComponent(value.trim()).replace(/\\/g, "/");
  } catch {
    return value.trim().replace(/\\/g, "/");
  }
}
