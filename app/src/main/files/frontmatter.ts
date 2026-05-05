import * as yaml from "js-yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

const DELIMITER = "---";

export function parseFrontmatter(content: string): ParsedFrontmatter {
  if (!content.startsWith(`${DELIMITER}\n`) && !content.startsWith(`${DELIMITER}\r\n`)) {
    return { data: {}, body: content };
  }

  const rest = content.slice(DELIMITER.length + 1);
  const closeIndex = rest.search(/^---$/m);

  if (closeIndex === -1) {
    return { data: {}, body: content };
  }

  const yamlText = rest.slice(0, closeIndex);
  const body = rest.slice(closeIndex + DELIMITER.length + 1);

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

  const yamlText = yaml.dump(data, { lineWidth: -1, quotingType: '"', forceQuotes: false });

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

export function parseFrontmatterCandidates(content: string): Map<string, string[]> {
  const result = new Map<string, string[]>();

  let currentField: string | null = null;

  for (const line of content.split("\n")) {
    const headingMatch = /^##\s+(.+)/.exec(line);

    if (headingMatch) {
      currentField = headingMatch[1].trim();
      result.set(currentField, []);
      continue;
    }

    if (currentField) {
      const bulletMatch = /^[-*+]\s+(.+)/.exec(line);

      if (bulletMatch) {
        result.get(currentField)!.push(bulletMatch[1].trim());
      } else if (line.trim() === "" || /^#/.test(line)) {
        currentField = null;
      }
    }
  }

  return result;
}
