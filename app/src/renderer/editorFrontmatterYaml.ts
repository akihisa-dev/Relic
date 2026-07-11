import { EditorState, type Text } from "@codemirror/state";
import * as yaml from "js-yaml";

import type { UserDefinedField } from "../shared/ipc";
import { fieldFor } from "./editorFrontmatterFields";

export interface FrontmatterBlock {
  bodyFrom: number;
  data: Record<string, unknown>;
  endLine: number;
  from: number;
  startLine: number;
  to: number;
  yamlText: string;
}

export interface YamlFieldEntry {
  end: number;
  key: string;
  start: number;
}

const topLevelYamlFieldPattern = /^([^#\s][^:]*):(?:\s|$)/;

function findYamlInlineComment(line: string): string | null {
  let quote: "'" | "\"" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = index > 0 ? line[index - 1] : "";

    if (quote) {
      if (char === quote && previous !== "\\") quote = null;
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (char === "#" && (index === 0 || /\s/.test(previous))) {
      return line.slice(index).trimEnd();
    }
  }

  return null;
}

function findYamlScalarQuote(line: string): "'" | "\"" | null {
  const match = /^[^:]+:\s*(["'])/.exec(line);
  if (!match) return null;

  return match[1] === "'" ? "'" : "\"";
}

export function findTopLevelYamlFieldEntries(lines: string[]): YamlFieldEntry[] {
  const entries: YamlFieldEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = topLevelYamlFieldPattern.exec(lines[index]);
    if (!match) continue;

    let end = index + 1;
    while (end < lines.length && /^[ \t]/.test(lines[end])) end += 1;

    entries.push({ end, key: match[1].trim(), start: index });
  }

  return entries;
}

export function serializeData(data: Record<string, unknown>, userDefinedFields: UserDefinedField[] = []): string {
  return Object.entries(data)
    .map(([key, value]) => {
      const field = fieldFor(key, userDefinedFields);
      if (value === "") return `${key}:`;
      if (field?.type === "date" && typeof value === "string") return `${key}: ${value}`;
      return yaml.dump({ [key]: value }, { lineWidth: -1 }).trimEnd();
    })
    .join("\n");
}

function serializeEntryPreservingQuote(
  entry: YamlFieldEntry,
  lines: string[],
  value: unknown,
  userDefinedFields: UserDefinedField[] = []
): string {
  if (Array.isArray(value) || entry.key === "chronicle") return serializeData({ [entry.key]: value }, userDefinedFields);

  if (entry.end !== entry.start + 1 || typeof value !== "string" || value.includes("\n")) {
    return serializeData({ [entry.key]: value }, userDefinedFields);
  }

  const quote = findYamlScalarQuote(lines[entry.start]);
  if (!quote) return serializeData({ [entry.key]: value }, userDefinedFields);

  if (quote === "'") {
    return `${entry.key}: '${value.replaceAll("'", "''")}'`;
  }

  return `${entry.key}: ${JSON.stringify(value)}`;
}

function serializeEntryPreservingInlineComment(
  entry: YamlFieldEntry,
  lines: string[],
  value: unknown,
  userDefinedFields: UserDefinedField[] = []
): string {
  const serialized = serializeEntryPreservingQuote(entry, lines, value, userDefinedFields);
  const comment = entry.end === entry.start + 1 ? findYamlInlineComment(lines[entry.start]) : null;

  if (!comment || serialized.includes("\n")) return serialized;

  return `${serialized} ${comment}`;
}

export function serializeDataPreservingYaml(
  block: FrontmatterBlock,
  data: Record<string, unknown>,
  userDefinedFields: UserDefinedField[] = []
): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return "";

  const lines = block.yamlText.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();

  const entries = findTopLevelYamlFieldEntries(lines);
  if (entries.length === 0) {
    const preservedPrefix = lines.join("\n").trimEnd();
    const serialized = serializeData(data, userDefinedFields);
    return preservedPrefix ? `${preservedPrefix}\n${serialized}` : serialized;
  }

  const entryByStart = new Map(entries.map((entry) => [entry.start, entry]));
  const writtenKeys = new Set<string>();
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const entry = entryByStart.get(index);
    if (!entry) {
      output.push(lines[index]);
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(data, entry.key)) {
      output.push(serializeEntryPreservingInlineComment(entry, lines, data[entry.key], userDefinedFields));
      writtenKeys.add(entry.key);
    }

    index = entry.end - 1;
  }

  for (const key of keys) {
    if (!writtenKeys.has(key)) output.push(serializeData({ [key]: data[key] }, userDefinedFields));
  }

  return output.join("\n");
}

export function findFrontmatterLineRange(doc: Text): { end: number; start: number } | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null;

  for (let lineNumber = 2; lineNumber <= doc.lines; lineNumber += 1) {
    if (doc.line(lineNumber).text.trim() === "---") {
      return { end: lineNumber, start: 1 };
    }
  }

  return null;
}

export function hasInvalidFrontmatterYaml(content: string): boolean {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines.length < 2 || lines[0].trim() !== "---") return false;

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex === -1) return true;

  const yamlText = lines.slice(1, endIndex).join("\n");
  try {
    const parsed = yaml.load(yamlText);
    return parsed !== null && parsed !== undefined && (typeof parsed !== "object" || Array.isArray(parsed));
  } catch {
    return true;
  }
}

export function findFrontmatterBlock(state: EditorState): FrontmatterBlock | null {
  const range = findFrontmatterLineRange(state.doc);
  if (!range) return null;

  const openLine = state.doc.line(range.start);
  const closeLine = state.doc.line(range.end);
  const yamlText = state.doc.sliceString(openLine.to + 1, closeLine.from);

  try {
    const parsed = yaml.load(yamlText);

    if (parsed === null || parsed === undefined) {
      return {
        bodyFrom: closeLine.to + 1,
        data: {},
        endLine: range.end,
        from: openLine.from,
        startLine: range.start,
        to: closeLine.to,
        yamlText
      };
    }
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;

    return {
      bodyFrom: closeLine.to + 1,
      data: parsed as Record<string, unknown>,
      endLine: range.end,
      from: openLine.from,
      startLine: range.start,
      to: closeLine.to,
      yamlText
    };
  } catch {
    return null;
  }
}
