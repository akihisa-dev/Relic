import * as yaml from "js-yaml";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

export interface InspectedFrontmatter extends ParsedFrontmatter {
  status: "invalid" | "none" | "valid";
}

const DELIMITER = "---";
export const maxFrontmatterYamlBytes = 1 * 1024 * 1024;
export const maxFrontmatterYamlLines = 20_000;
export const maxFrontmatterYamlAliases = 100;
export const maxFrontmatterYamlDepth = 64;

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const { data, body } = inspectFrontmatter(content);
  return { data, body };
}

export function inspectFrontmatter(content: string): InspectedFrontmatter {
  const openDelimiter = /^---\r?\n/.exec(content);

  if (!openDelimiter) {
    return { data: {}, body: content, status: "none" };
  }

  const rest = content.slice(openDelimiter[0].length);
  const closeDelimiter = /^---(?:\r?\n|$)/m.exec(rest);

  if (!closeDelimiter || closeDelimiter.index === undefined) {
    return { data: {}, body: content, status: "invalid" };
  }

  const yamlText = rest.slice(0, closeDelimiter.index);
  const body = rest.slice(closeDelimiter.index + closeDelimiter[0].length);

  if (yamlText.trim() === "") {
    return { data: {}, body, status: "valid" };
  }

  if (!isFrontmatterYamlWithinBudget(yamlText)) {
    return { data: {}, body: content, status: "invalid" };
  }

  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) {
      return { data: {}, body, status: "valid" };
    }

    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return { data: {}, body: content, status: "invalid" };
    }

    const data = parsed as Record<string, unknown>;
    if (containsUnsafeFrontmatterKey(data)) {
      return { data: {}, body: content, status: "invalid" };
    }

    return { data, body, status: "valid" };
  } catch {
    return { data: {}, body: content, status: "invalid" };
  }
}

export function isUnsafeFrontmatterKey(key: string): boolean {
  return key === "__proto__" || key === "prototype" || key === "constructor";
}

function containsUnsafeFrontmatterKey(value: unknown, depth = 0, seen = new WeakSet<object>()): boolean {
  if (depth > maxFrontmatterYamlDepth) return true;
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsUnsafeFrontmatterKey(item, depth + 1, seen));
  return Object.entries(value).some(([key, child]) =>
    isUnsafeFrontmatterKey(key) || containsUnsafeFrontmatterKey(child, depth + 1, seen)
  );
}

function isFrontmatterYamlWithinBudget(yamlText: string): boolean {
  if (Buffer.byteLength(yamlText, "utf8") > maxFrontmatterYamlBytes) return false;
  const lines = yamlText.split(/\r?\n/);
  if (lines.length > maxFrontmatterYamlLines) return false;
  const aliases = (yamlText.match(/(^|[\s,:\[\]{])(?:&|\*)[-A-Za-z0-9_.\/]+/gm) ?? []).length;
  if (aliases > maxFrontmatterYamlAliases) return false;

  for (const line of lines) {
    const indentation = line.match(/^[ \t]*/)?.[0] ?? "";
    const spaces = indentation.replace(/\t/g, "  ").length;
    if (Math.floor(spaces / 2) > maxFrontmatterYamlDepth) return false;
  }
  return true;
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
