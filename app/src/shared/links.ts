import { ensureMarkdownExtension, stripMarkdownExtension } from "./markdownExtension";
import {
  collectMarkdownCodeRanges,
  decodeMarkdownPath,
  isMarkdownOffsetInRanges,
  normalizeMarkdownPathSegments
} from "./markdownScan";
import { normalizeUrlForSecurity } from "./urlSafety";

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

interface ScanWikiLinksOptions {
  ignoreCode?: boolean;
  limit?: number;
}

export function parseWikiLinks(markdown: string, options: ScanWikiLinksOptions = {}): WikiLink[] {
  return scanWikiLinks(markdown, options).map(({ body: _body, bodyFrom: _bodyFrom, bodyTo: _bodyTo, from: _from, rawTargetBase: _rawTargetBase, targetBase: _targetBase, to: _to, ...link }) => link);
}

export function scanWikiLinks(markdown: string, options: ScanWikiLinksOptions = {}): WikiLinkMatch[] {
  const links: WikiLinkMatch[] = [];
  const codeRanges = options.ignoreCode === false ? [] : collectMarkdownCodeRanges(markdown);
  const limit = Number.isInteger(options.limit) && Number(options.limit) >= 0
    ? Number(options.limit)
    : Number.POSITIVE_INFINITY;
  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  if (limit === 0) return links;

  for (const match of markdown.matchAll(pattern)) {
    const from = match.index;
    if (from === undefined || isMarkdownOffsetInRanges(from, codeRanges)) continue;

    const raw = match[0] ?? "";
    const body = match[2] ?? "";
    const parsed = parseWikiLinkBody(body);

    if (raw && parsed) {
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

      if (links.length >= limit) break;
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
    return normalizeMarkdownPathSegments(normalizedTarget);
  }

  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";

  return normalizeMarkdownPathSegments(
    sourceDirectory === "" ? normalizedTarget : `${sourceDirectory}/${normalizedTarget}`
  );
}

export function resolveMarkdownLinkPath(href: string, sourcePath: string): MarkdownLinkTarget | null {
  const trimmedHref = normalizeUrlForSecurity(href);

  if (
    trimmedHref === null ||
    trimmedHref === "" ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmedHref) ||
    trimmedHref.startsWith("//") ||
    trimmedHref.startsWith("#")
  ) {
    return null;
  }

  const [pathPart, headingPart] = trimmedHref.split("#", 2);
  const decodedPath = decodeMarkdownPath(pathPart);
  if (
    normalizeUrlForSecurity(decodedPath) === null ||
    decodedPath === "" ||
    /^[a-z][a-z0-9+.-]*:/i.test(decodedPath) ||
    decodedPath.startsWith("//")
  ) {
    return null;
  }

  const heading = headingPart ? decodeMarkdownPath(headingPart).trim() || null : null;
  if (heading !== null && normalizeUrlForSecurity(heading) === null) return null;

  const sourceDirectory = sourcePath.includes("/")
    ? sourcePath.split("/").slice(0, -1).join("/")
    : "";
  const normalizedTarget = resolveMarkdownPathWithinWorkspace(
    decodedPath,
    sourceDirectory,
    decodedPath.startsWith("/")
  );
  if (normalizedTarget === null) return null;

  return {
    heading,
    path: ensureMarkdownExtension(normalizedTarget)
  };
}

export function resolveWikiLinks(
  markdown: string,
  sourcePath: string,
  existingMarkdownPaths: Iterable<string>,
  aliasesByPath: AliasIndex = {},
  options: ScanWikiLinksOptions = {}
): ResolvedWikiLink[] {
  return createWikiLinkResolver(existingMarkdownPaths, aliasesByPath)(markdown, sourcePath, options);
}

export function createWikiLinkResolver(
  existingMarkdownPaths: Iterable<string>,
  aliasesByPath: AliasIndex = {}
): (markdown: string, sourcePath: string, options?: ScanWikiLinksOptions) => ResolvedWikiLink[] {
  const normalizedExistingPaths = [...new Set([...existingMarkdownPaths].map(normalizeMarkdownPathSegments))];
  const existingPaths = new Set(normalizedExistingPaths);
  const uniquePathTargets = buildUniquePathTargetMap(normalizedExistingPaths);
  const uniqueBasenameTargets = buildUniqueBasenameTargetMap(normalizedExistingPaths);
  const aliasTargets = buildAliasTargetMap(aliasesByPath);

  return (markdown, sourcePath, options = {}) => parseWikiLinks(markdown, options).map((wikiLink) => {
    const resolvedPath = resolveWikiLinkPath(wikiLink.target, sourcePath);
    const existingPath = existingPaths.has(resolvedPath)
      ? resolvedPath
      : uniquePathTargets.get(markdownPathKey(resolvedPath)) ?? null;
    const uniqueBasenamePath = existingPath
      ? null
      : uniqueBasenameTargets.get(basenameLinkKey(wikiLink.target)) ?? null;
    const aliasPath = existingPath || uniqueBasenamePath
      ? null
      : aliasTargets.get(aliasKey(wikiLink.target)) ?? null;
    const path = existingPath ?? uniqueBasenamePath ?? aliasPath ?? resolvedPath;

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
  const normalizedExistingPaths = [...new Set([...existingMarkdownPaths].map(normalizeMarkdownPathSegments))];
  const existingPaths = new Set(normalizedExistingPaths);

  if (existingPaths.has(resolvedPath)) return resolvedPath;

  const uniquePathTarget = buildUniquePathTargetMap(normalizedExistingPaths).get(markdownPathKey(resolvedPath)) ?? null;
  if (uniquePathTarget) return uniquePathTarget;

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

function buildUniquePathTargetMap(paths: string[]): Map<string, string> {
  const targets = new Map<string, string | null>();

  for (const path of paths) {
    const key = markdownPathKey(path);
    targets.set(key, targets.has(key) ? null : path);
  }

  return new Map([...targets.entries()].filter((entry): entry is [string, string] => entry[1] !== null));
}

function markdownPathKey(path: string): string {
  return `${stripMarkdownExtension(path)}.md`;
}

function buildAliasTargetMap(aliasesByPath: AliasIndex): Map<string, string> {
  const result = new Map<string, string>();

  for (const [path, aliases] of Object.entries(aliasesByPath).sort(([a], [b]) => a.localeCompare(b))) {
    for (const alias of aliases) {
      const key = aliasKey(alias);
      if (key && !result.has(key)) result.set(key, normalizeMarkdownPathSegments(path));
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

function resolveMarkdownPathWithinWorkspace(
  target: string,
  sourceDirectory: string,
  rootRelative: boolean
): string | null {
  const targetSegments = target.replace(/\\/g, "/").split("/");
  if (targetSegments.length === 0 || targetSegments.at(-1) === "" || targetSegments.at(-1) === "." || targetSegments.at(-1) === "..") {
    return null;
  }

  const output = rootRelative
    ? []
    : sourceDirectory.split("/").filter((segment) => segment !== "" && segment !== ".");

  for (const segment of targetSegments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (output.length === 0) return null;
      output.pop();
      continue;
    }
    output.push(segment);
  }

  return output.length > 0 ? output.join("/") : null;
}
