export interface ParsedTags {
  frontmatterTags: string[];
  tags: string[];
}

export function parseMarkdownTags(markdown: string): ParsedTags {
  const frontmatter = splitFrontmatter(markdown);
  const frontmatterTags = uniqueTags(parseFrontmatterTags(frontmatter));

  return {
    frontmatterTags,
    tags: frontmatterTags
  };
}

function splitFrontmatter(markdown: string): string | null {
  if (!markdown.startsWith("---\n")) {
    return null;
  }

  const endIndex = markdown.indexOf("\n---", 4);

  if (endIndex === -1) {
    return null;
  }

  return markdown.slice(4, endIndex);
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
    .flatMap((item) => {
      const tag = cleanTagValue(item);
      return tag ? [tag] : [];
    });
}

function cleanTagValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "").replace(/^#/, "");
}

function uniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.flatMap((item) => {
    const tag = cleanTagValue(item);
    return tag ? [tag] : [];
  }))).toSorted((a, b) =>
    a.localeCompare(b, "ja")
  );
}
