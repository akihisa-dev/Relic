import * as yaml from "js-yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

const DELIMITER = "---";

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const openDelimiter = /^---\r?\n/.exec(content);

  if (!openDelimiter) {
    return { data: {}, body: content };
  }

  const rest = content.slice(openDelimiter[0].length);
  const closeDelimiter = /^---(?:\r?\n|$)/m.exec(rest);

  if (!closeDelimiter || closeDelimiter.index === undefined) {
    return { data: {}, body: content };
  }

  const yamlText = rest.slice(0, closeDelimiter.index);
  const body = rest.slice(closeDelimiter.index + closeDelimiter[0].length);

  if (yamlText.trim() === "") {
    return { data: {}, body };
  }

  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) {
      return { data: {}, body };
    }

    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return { data: {}, body: content };
    }

    return { data: parsed as Record<string, unknown>, body };
  } catch {
    return { data: {}, body: content };
  }
}

export function writeFrontmatter(body: string, data: Record<string, unknown>): string {
  const keys = Object.keys(data);

  if (keys.length === 0) {
    return body;
  }

  const yamlText = yaml.dump(data, { flowLevel: 1, lineWidth: -1, quoteStyle: "double", forceQuotes: false });

  return `${DELIMITER}\n${yamlText}${DELIMITER}\n${body}`;
}

export function updateFrontmatter(
  content: string,
  updater: (data: Record<string, unknown>) => Record<string, unknown>
): string {
  const { data, body } = parseFrontmatter(content);
  const nextData = updater({ ...data });

  return writeFrontmatter(body, nextData);
}
