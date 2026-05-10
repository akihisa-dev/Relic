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

export function parseWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = [];
  const source = maskFencedCodeBlocks(markdown);
  const pattern = /(!)?\[\[([^\]\n]+)\]\]/g;

  for (const match of source.matchAll(pattern)) {
    const parsed = parseWikiLinkBody(match[2], match[1] === "!" ? "embed" : "link");

    if (parsed) {
      links.push({
        ...parsed,
        raw: match[0]
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
  existingMarkdownPaths: Iterable<string>
): ResolvedWikiLink[] {
  const existingPaths = new Set([...existingMarkdownPaths].map(normalizePathSegments));

  return parseWikiLinks(markdown).map((wikiLink) => {
    const resolvedPath = resolveWikiLinkPath(wikiLink.target, sourcePath);

    return {
      displayName: wikiLink.alias ?? resolvedPath.split("/").at(-1)!.replace(/\.md$/, ""),
      exists: existingPaths.has(resolvedPath),
      path: resolvedPath,
      wikiLink
    };
  });
}

function parseWikiLinkBody(
  body: string,
  kind: WikiLinkKind
): Omit<WikiLink, "raw"> | null {
  const [targetPart, aliasPart] = body.split("|", 2);
  const normalizedTargetPart = targetPart.trim();

  if (normalizedTargetPart === "") return null;

  const blockParts = normalizedTargetPart.split("^", 2);
  const headingParts = blockParts[0].split("#", 2);
  const target = headingParts[0].trim();

  if (target === "") return null;

  return {
    alias: aliasPart?.trim() || null,
    blockId: blockParts[1]?.trim() || null,
    heading: headingParts[1]?.trim() || null,
    kind,
    target: normalizeWikiLinkTarget(target)
  };
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

function decodeMarkdownLinkPath(value: string): string {
  try {
    return decodeURIComponent(value.trim()).replace(/\\/g, "/");
  } catch {
    return value.trim().replace(/\\/g, "/");
  }
}
