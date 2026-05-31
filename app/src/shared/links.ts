export type WikiLinkKind = "embed" | "link";

export interface WikiLink {
  alias: string | null;
  blockId: string | null;
  heading: string | null;
  kind: WikiLinkKind;
  raw: string;
  target: string;
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
  const links: WikiLink[] = [];
  const source = maskFencedCodeBlocks(markdown);
  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of source.matchAll(pattern)) {
    const raw = match[0] ?? "";
    const parsed = parseWikiLinkBody(match[2] ?? "", match[1] === "!" ? "embed" : "link");

    if (parsed) {
      links.push({
        ...parsed,
        raw
      });
    }
  }

  return links;
}

export function normalizeWikiLinkTarget(target: string): string {
  const trimmed = target.trim().replace(/\\/g, "/");

  return trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
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
    trimmedHref.startsWith("#")
  ) {
    return null;
  }

  const [pathPart, headingPart] = trimmedHref.split("#", 2);
  const decodedPath = decodeMarkdownLinkPath(pathPart);
  const normalizedTarget = decodedPath.endsWith(".md") ? decodedPath : `${decodedPath}.md`;
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
  const existingPaths = new Set([...existingMarkdownPaths].map(normalizePathSegments));
  const aliasTargets = buildAliasTargetMap(aliasesByPath);

  return (markdown, sourcePath) => parseWikiLinks(markdown).map((wikiLink) => {
    const resolvedPath = resolveWikiLinkPath(wikiLink.target, sourcePath);
    const aliasPath = existingPaths.has(resolvedPath) ? null : aliasTargets.get(aliasKey(wikiLink.target)) ?? null;
    const path = aliasPath ?? resolvedPath;

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
  const existingPaths = new Set([...existingMarkdownPaths].map(normalizePathSegments));

  if (existingPaths.has(resolvedPath)) return resolvedPath;

  return buildAliasTargetMap(aliasesByPath).get(aliasKey(target)) ?? resolvedPath;
}

function parseWikiLinkBody(
  body: string,
  kind: WikiLinkKind
): Omit<WikiLink, "raw"> | null {
  const [targetPart = "", aliasPart] = body.split("|", 2);
  const normalizedTargetPart = targetPart.trim();

  if (normalizedTargetPart === "") return null;

  const [targetWithHeading = "", blockId] = normalizedTargetPart.split("^", 2);
  const [targetBase = "", heading] = targetWithHeading.split("#", 2);
  const target = targetBase.trim();

  if (target === "") return null;

  return {
    alias: aliasPart?.trim() || null,
    blockId: blockId?.trim() || null,
    heading: heading?.trim() || null,
    kind,
    target: normalizeWikiLinkTarget(target)
  };
}

function basenameWithoutMarkdownExtension(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.md$/, "");
}

function maskFencedCodeBlocks(markdown: string): string {
  return markdown.replace(/^```[\s\S]*?^```/gm, (block) => " ".repeat(block.length));
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
