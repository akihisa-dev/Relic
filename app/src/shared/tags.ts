export interface ParsedTags {
  bodyTags: string[];
  frontmatterTags: string[];
  tags: string[];
}

export function parseMarkdownTags(markdown: string): ParsedTags {
  const { body, frontmatter } = splitFrontmatter(markdown);
  const bodyTags = uniqueTags(parseBodyTags(body));
  const frontmatterTags = uniqueTags(parseFrontmatterTags(frontmatter));

  return {
    bodyTags,
    frontmatterTags,
    tags: uniqueTags([...frontmatterTags, ...bodyTags])
  };
}

function splitFrontmatter(markdown: string): { body: string; frontmatter: string | null } {
  if (!markdown.startsWith("---\n")) {
    return { body: markdown, frontmatter: null };
  }

  const endIndex = markdown.indexOf("\n---", 4);

  if (endIndex === -1) {
    return { body: markdown, frontmatter: null };
  }

  return {
    body: markdown.slice(endIndex + 5),
    frontmatter: markdown.slice(4, endIndex)
  };
}

function parseBodyTags(markdown: string): string[] {
  const source = maskCode(markdown);
  const tags: string[] = [];
  const pattern = /(^|[\s([{])#([\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*)/gu;

  for (const match of source.matchAll(pattern)) {
    tags.push(match[2]);
  }

  return tags;
}

function parseFrontmatterTags(frontmatter: string | null): string[] {
  if (!frontmatter) return [];

  const lines = frontmatter.split("\n");
  const tags: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const inlineMatch = /^tags:\s*(.*?)\s*$/.exec(line);

    if (!inlineMatch) continue;

    const value = inlineMatch[1].trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      tags.push(...parseInlineArray(value));
      continue;
    }

    if (value !== "") {
      tags.push(cleanTagValue(value));
      continue;
    }

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const itemMatch = /^\s*-\s+(.+?)\s*$/.exec(lines[nextIndex]);

      if (itemMatch) {
        tags.push(cleanTagValue(itemMatch[1]));
        continue;
      }

      if (/^\S/.test(lines[nextIndex])) break;
    }
  }

  return tags.filter(Boolean);
}

function parseInlineArray(value: string): string[] {
  return value
    .slice(1, -1)
    .split(",")
    .map(cleanTagValue)
    .filter(Boolean);
}

function cleanTagValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map(cleanTagValue).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

function maskCode(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```/gm, (block) => " ".repeat(block.length))
    .replace(/`[^`\n]+`/g, (code) => " ".repeat(code.length));
}
