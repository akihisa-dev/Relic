export type WikiLinkKind = "embed" | "link";

export interface WikiLink {
  alias: string | null;
  blockId: string | null;
  heading: string | null;
  kind: WikiLinkKind;
  raw: string;
  target: string;
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
